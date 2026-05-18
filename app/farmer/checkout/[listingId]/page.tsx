'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, runTransaction, Timestamp, collection } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, MarketplaceOrder, MarketplacePickupWindow, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FarmerHeader } from '@/components/FarmerHeader';

export default function CheckoutPage() {
  return (
    <RoleGuard allowedRoles={['farmer']}>
      <CheckoutContent />
    </RoleGuard>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.listingId as string;

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<MarketplacePickupWindow | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [finalWindow, setFinalWindow] = useState<MarketplacePickupWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropdownOpen]);

  useEffect(() => {
    const unsub = onAuthStateChange(async (cu) => {
      if (cu) {
        setUser(cu);
        const profile = await getUserProfile(cu.uid);
        setUserProfile(profile);
        await loadListing();
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router, listingId]);

  const loadListing = async () => {
    try {
      const db = getFirestoreDb();
      const ld = await getDoc(doc(db, getListingsCollectionPath(), listingId));
      if (!ld.exists()) {
        toast.error('Listing not found');
        router.push('/farmer');
        return;
      }
      const data = { id: ld.id, ...ld.data() } as MarketplaceListing;
      if (data.status !== 'live') {
        toast.error('This listing is no longer available');
        router.push('/farmer');
        return;
      }
      setListing(data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load listing');
      router.push('/farmer');
    }
  };

  const isMultiDayWindow = (window: MarketplacePickupWindow): boolean => {
    const s = new Date(window.start), e = new Date(window.end);
    return (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) >= 1;
  };

  const getAvailableDates = (window: MarketplacePickupWindow): string[] => {
    const start = new Date(window.start), end = new Date(window.end);
    const dates: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const createDateWindow = (window: MarketplacePickupWindow, date: string): MarketplacePickupWindow => {
    const start = new Date(window.start), end = new Date(window.end);
    const sel = new Date(date);
    const newStart = new Date(sel); newStart.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const newEnd = new Date(sel); newEnd.setHours(end.getHours(), end.getMinutes(), 0, 0);
    if (sel.toDateString() === end.toDateString()) newEnd.setTime(end.getTime());
    return { start: newStart.toISOString(), end: newEnd.toISOString() };
  };

  useEffect(() => {
    if (selectedWindow && selectedDate) {
      if (isMultiDayWindow(selectedWindow)) setFinalWindow(createDateWindow(selectedWindow, selectedDate));
      else setFinalWindow(selectedWindow);
    } else if (selectedWindow && !isMultiDayWindow(selectedWindow)) {
      setFinalWindow(selectedWindow);
    } else {
      setFinalWindow(null);
    }
  }, [selectedWindow, selectedDate]);

  const handleConfirmPurchase = async () => {
    const windowToUse = finalWindow || selectedWindow;
    if (!windowToUse || !user || !listing) {
      if (!selectedWindow) toast.error('Please select a pickup window');
      else if (isMultiDayWindow(selectedWindow) && !selectedDate) toast.error('Please select a pickup date');
      return;
    }
    setSubmitting(true);
    try {
      const db = getFirestoreDb();
      const listingRef = doc(db, getListingsCollectionPath(), listingId);
      await runTransaction(db, async (tx) => {
        const ld = await tx.get(listingRef);
        if (!ld.exists()) throw new Error('Listing not found');
        const cur = ld.data() as MarketplaceListing;
        if (cur.status !== 'live') throw new Error('Listing is no longer available');
        tx.update(listingRef, {
          status: 'reserved', reservedBy: user.uid,
          reservedAt: Timestamp.now(), scheduledWindow: windowToUse,
        });
        const orderRef = doc(collection(db, getOrdersCollectionPath()));
        const data: Omit<MarketplaceOrder, 'id'> = {
          listingId, generatorUid: cur.generatorUid, farmerUid: user.uid,
          scheduledWindow: windowToUse, paymentMethod: 'cash', status: 'reserved',
          price: cur.price, currency: cur.currency, title: cur.title,
          category: cur.category, imageUrl: cur.imageUrl, address: cur.address,
          latitude: cur.latitude, longitude: cur.longitude, createdAt: Timestamp.now(),
        };
        tx.set(orderRef, data);
      });
      toast.success('Purchase confirmed! Check your orders for pickup details.');
      router.push('/orders');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to confirm purchase. Listing may have been taken.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          preparing the ledger<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }
  if (!listing) return null;

  const readyToConfirm = !!selectedWindow && (!isMultiDayWindow(selectedWindow) || !!selectedDate);

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      <FarmerHeader
        userProfile={userProfile}
        active="marketplace"
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef}
        router={router}
      />

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-10 py-8">
        <Link href={`/farmer/listings/${listingId}`}
              className="inline-flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] mb-8">
          <span aria-hidden>←</span> Back to specimen
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
            Chapter 04 · The Pledge
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            FCFS · First Come, First Served
          </span>
        </div>

        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-12">
          Confirm the <span className="italic">handover.</span>
        </h1>

        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          {/* —— Left: Pickup window selection —— */}
          <section className="col-span-12 lg:col-span-7">
            <div className="rf-eyebrow mb-4">01 · Choose a pickup window</div>

            <div className="space-y-3">
              {listing.pickupWindows.map((window, i) => {
                const isPast = new Date(window.end) < new Date();
                const isMulti = isMultiDayWindow(window);
                const isSelected = selectedWindow === window;
                const start = new Date(window.start), end = new Date(window.end);

                return (
                  <div key={i} className="space-y-3">
                    <button
                      onClick={() => {
                        if (!isPast) {
                          setSelectedWindow(window);
                          if (isMulti) setSelectedDate('');
                        }
                      }}
                      disabled={isPast}
                      className="w-full text-left p-5 rounded-2xl border-2 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        borderColor: isSelected ? 'var(--rf-sap)' : 'rgba(241,234,216,.14)',
                        background: isSelected ? 'rgba(200,255,77,.06)' : 'rgba(241,234,216,.025)',
                      }}>
                      <div className="flex items-start gap-4">
                        <span className="font-fraunces fraunces-wonk italic text-5xl font-light leading-none shrink-0"
                              style={{ color: isSelected ? 'var(--rf-sap)' : 'var(--rf-bone)' }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1">
                          <p className="font-fraunces text-xl font-medium leading-tight">
                            {start.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-70 mt-1">
                            → {end.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {isPast && (
                              <span className="font-mono-jb text-[9px] uppercase tracking-[0.25em]" style={{ color: 'var(--rf-rust)' }}>
                                ⚠ window has passed
                              </span>
                            )}
                            {isMulti && !isPast && (
                              <span className="font-mono-jb text-[9px] uppercase tracking-[0.25em]" style={{ color: 'var(--rf-sap)' }}>
                                ↻ multi-day · choose a date below
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="size-3 rounded-full mt-2 shrink-0" style={{ background: 'var(--rf-sap)' }} />
                        )}
                      </div>
                    </button>

                    {isSelected && isMulti && !isPast && (
                      <div className="ml-4 p-5 rounded-2xl border"
                           style={{ borderColor: 'rgba(200,255,77,.25)', background: 'rgba(200,255,77,.04)' }}>
                        <label className="rf-eyebrow mb-2 block">Select a pickup date</label>
                        <div className="relative">
                          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                                  className="appearance-none w-full rf-input py-3 pl-4 pr-10 cursor-pointer">
                            <option value="">Choose a date…</option>
                            {getAvailableDates(window).map((date) => {
                              const d = new Date(date);
                              const today = new Date(); today.setHours(0, 0, 0, 0);
                              const past = d < today;
                              return (
                                <option key={date} value={date} disabled={past}>
                                  {d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  {past && ' (past)'}
                                </option>
                              );
                            })}
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: 'var(--rf-sap)' }}>expand_more</span>
                        </div>
                        {selectedDate && (
                          <p className="mt-3 font-instrument italic text-base" style={{ color: 'var(--rf-sap)' }}>
                            ✓ Pickup set for{' '}
                            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* —— Right: Ledger summary —— */}
          <aside className="col-span-12 lg:col-span-5">
            <div className="sticky top-24">
              <div className="rf-eyebrow mb-4">02 · The ledger</div>

              <div className="rounded-2xl border overflow-hidden"
                   style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>

                {/* Item header */}
                <div className="flex gap-4 p-5 border-b" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                  <img src={listing.imageUrl} alt={listing.title}
                       className="w-24 h-24 object-cover rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-fraunces text-xl font-medium tracking-tight leading-tight">
                      {listing.title}
                    </h3>
                    <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1">
                      {listing.category}
                    </p>
                    {listing.weightKg && (
                      <p className="font-instrument italic text-base mt-2" style={{ color: 'var(--rf-bone)' }}>
                        ~{listing.weightKg} kg
                      </p>
                    )}
                    <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1 truncate">
                      {listing.address}
                    </p>
                  </div>
                </div>

                {/* Summary lines */}
                <div className="p-5 space-y-3">
                  <Line label="Parcel" value={listing.title} />
                  <Line label="Payment" value="Cash on pickup" />
                  {readyToConfirm && (
                    <Line
                      label="Pickup before"
                      value={new Date((finalWindow || selectedWindow!).end).toLocaleString([], {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    />
                  )}
                </div>

                {/* Total */}
                <div className="flex items-baseline justify-between p-5 border-t"
                     style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(13,26,16,.4)' }}>
                  <span className="rf-eyebrow">Total due on pickup</span>
                  <p className="font-fraunces fraunces-wonk text-5xl font-light leading-none tracking-[-0.04em]"
                     style={{ color: 'var(--rf-sap)' }}>
                    <span className="font-mono-jb text-sm mr-1 align-baseline opacity-70"
                          style={{ color: 'var(--rf-bone)' }}>{listing.currency}</span>
                    {listing.price.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-5">
                <Link href={`/farmer/listings/${listingId}`}
                      className="flex-1 inline-flex items-center justify-center h-14 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                      style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                  Cancel
                </Link>
                <button onClick={handleConfirmPurchase}
                        disabled={!readyToConfirm || submitting}
                        className="group flex-[1.5] inline-flex items-center justify-between pl-6 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed rf-glow-sap"
                        style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                  <span>{submitting ? 'Sealing the pledge…' : 'Confirm pledge'}</span>
                  <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                        style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                    {submitting ? (
                      <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              </div>

              {/* Footnote */}
              <p className="font-instrument italic text-sm mt-6 leading-snug"
                 style={{ color: 'rgba(241,234,216,.55)' }}>
                The first farmer to confirm holds the parcel. If another claims before you, we&apos;ll let you know — no harm done.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b pb-2 last:border-0 last:pb-0"
         style={{ borderColor: 'rgba(241,234,216,.06)' }}>
      <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 shrink-0">{label}</span>
      <span className="font-fraunces text-base text-right truncate">{value}</span>
    </div>
  );
}
