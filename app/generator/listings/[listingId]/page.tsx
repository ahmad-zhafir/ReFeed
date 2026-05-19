'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { GeneratorLayout } from '@/components/GeneratorLayout';

export default function GeneratorListingDetailPage() {
  return (
    <RoleGuard allowedRoles={['generator']}>
      <GeneratorListingDetailContent />
    </RoleGuard>
  );
}

function GeneratorListingDetailContent() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.listingId as string;

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        await loadListing(currentUser.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router, listingId]);

  const loadListing = async (generatorUid: string) => {
    try {
      const db = getFirestoreDb();
      const ld = await getDoc(doc(db, getListingsCollectionPath(), listingId));
      if (!ld.exists()) { toast.error('Listing not found'); router.push('/generator/listings'); return; }
      const data = { id: ld.id, ...ld.data() } as MarketplaceListing;
      if (data.generatorUid !== generatorUid) { toast.error('Unauthorized'); router.push('/generator/listings'); return; }
      setListing(data);
      if (data.status === 'reserved' && data.reservedBy) {
        const ordersSnap = await getDocs(query(collection(db, getOrdersCollectionPath()), where('listingId', '==', listingId)));
        if (!ordersSnap.empty) setOrderInfo(ordersSnap.docs[0].data());
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load listing');
      router.push('/generator/listings');
    }
  };

  const markCompleted = async () => {
    if (!listing) return;
    try {
      const db = getFirestoreDb();
      await updateDoc(doc(db, getListingsCollectionPath(), listingId), { status: 'completed' });
      if (orderInfo) {
        const snap = await getDocs(query(collection(db, getOrdersCollectionPath()), where('listingId', '==', listingId)));
        if (!snap.empty) await updateDoc(snap.docs[0].ref, { status: 'completed' });
      }
      toast.success('Listing marked as collected');
      router.push('/generator/listings');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update listing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          opening the entry<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }
  if (!listing) return null;

  const allImages = listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls : [listing.imageUrl];
  const currentImg = allImages[selectedImageIndex] || listing.imageUrl;

  return (
    <GeneratorLayout user={user} userProfile={userProfile} active="inventory" router={router}>
      <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">
        <Link href="/generator/listings"
              className="inline-flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] mb-8">
          <span aria-hidden>←</span> Back to ledger
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
            Entry №{listing.id?.slice(0, 6).toUpperCase() || '------'}
          </div>
          <ListingStatusPill status={listing.status} />
        </div>

        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-10">
          {listing.title}
        </h1>

        <div className="grid grid-cols-12 gap-x-8 gap-y-10">

          {/* Gallery */}
          <div className="col-span-12 lg:col-span-7">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'var(--rf-moss)' }}>
              <img src={currentImg} alt={listing.title}
                   className="w-full h-full object-cover"
                   onError={(e) => {
                     const t = e.target as HTMLImageElement;
                     t.src = listing.imageUrl || 'https://via.placeholder.com/800x600';
                   }} />
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full backdrop-blur-md border font-mono-jb text-[10px] uppercase tracking-[0.25em]"
                   style={{ background: 'rgba(13,26,16,.6)', borderColor: 'rgba(241,234,216,.18)', color: 'var(--rf-bone)' }}>
                {allImages.length > 1 ? `${selectedImageIndex + 1} / ${allImages.length}` : 'plate · I'}
              </div>
              {allImages.length > 1 && (
                <>
                  <button onClick={() => setSelectedImageIndex((p) => p > 0 ? p - 1 : allImages.length - 1)}
                          aria-label="Previous"
                          className="absolute left-4 top-1/2 -translate-y-1/2 size-11 rounded-full flex items-center justify-center backdrop-blur-md border hover:bg-white/10 transition-all"
                          style={{ background: 'rgba(13,26,16,.6)', borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button onClick={() => setSelectedImageIndex((p) => p < allImages.length - 1 ? p + 1 : 0)}
                          aria-label="Next"
                          className="absolute right-4 top-1/2 -translate-y-1/2 size-11 rounded-full flex items-center justify-center backdrop-blur-md border hover:bg-white/10 transition-all"
                          style={{ background: 'rgba(13,26,16,.6)', borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
                {allImages.map((url, i) => (
                  <button key={i} onClick={() => setSelectedImageIndex(i)}
                          className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all"
                          style={{ borderColor: selectedImageIndex === i ? 'var(--rf-sap)' : 'rgba(241,234,216,.12)' }}>
                    <img src={url} alt={`Plate ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="col-span-12 lg:col-span-5">
            <div className="rounded-2xl p-7 border space-y-7"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>

              <div className="flex items-baseline justify-between border-b pb-5"
                   style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                <div>
                  <p className="rf-eyebrow mb-1">Listed price</p>
                  <p className="font-fraunces fraunces-wonk text-6xl font-light leading-none tracking-[-0.04em]"
                     style={{ color: 'var(--rf-sap)' }}>
                    <span className="font-mono-jb text-base mr-1 align-baseline opacity-70"
                          style={{ color: 'var(--rf-bone)' }}>{listing.currency}</span>
                    {listing.price.toFixed(2)}
                  </p>
                </div>
                <span className="px-3 py-1.5 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.25em] border"
                      style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                  {listing.category}
                </span>
              </div>

              <Spec label="01 · Pickup location">
                <p className="font-fraunces text-base leading-snug">{listing.address}</p>
              </Spec>
              {listing.weightKg && (
                <Spec label="02 · Weight">
                  <p className="font-fraunces fraunces-wonk italic text-3xl font-light"
                     style={{ color: 'var(--rf-bone)' }}>
                    ~{listing.weightKg}<span className="font-mono-jb text-xs ml-1 not-italic opacity-60">kg</span>
                  </p>
                </Spec>
              )}
              {listing.notes && (
                <Spec label="03 · Notes">
                  <p className="font-instrument italic text-lg leading-snug"
                     style={{ color: 'rgba(241,234,216,.8)' }}>
                    &ldquo;{listing.notes}&rdquo;
                  </p>
                </Spec>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              {listing.status === 'live' && (
                <Link href={`/generator/listings/${listingId}/edit`}
                      className="flex-1 inline-flex items-center justify-center h-14 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                      style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                  ✎ Edit entry
                </Link>
              )}
              {listing.status === 'reserved' && (
                <button onClick={markCompleted}
                        className="group flex-1 inline-flex items-center justify-between pl-6 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                        style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                  <span>Mark as collected</span>
                  <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                        style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Reserved order info */}
          {listing.status === 'reserved' && orderInfo && (
            <section className="col-span-12 rounded-2xl p-6 md:p-8 border rf-fade-up"
                     style={{ borderColor: 'rgba(233,196,106,.3)', background: 'rgba(233,196,106,.05)' }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--rf-amber)' }}>pending</span>
                <p className="rf-eyebrow" style={{ color: 'var(--rf-amber)' }}>A farmer has claimed this entry</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="rf-eyebrow mb-2">Scheduled pickup</p>
                  <p className="font-fraunces text-lg leading-snug">
                    {new Date(orderInfo.scheduledWindow.start).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    {' – '}
                    {new Date(orderInfo.scheduledWindow.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </p>
                </div>
                <div>
                  <p className="rf-eyebrow mb-2">Payment</p>
                  <p className="font-fraunces fraunces-wonk text-3xl font-light leading-none"
                     style={{ color: 'var(--rf-sap)' }}>
                    <span className="font-mono-jb text-xs opacity-70 mr-1" style={{ color: 'var(--rf-bone)' }}>{orderInfo.currency}</span>
                    {orderInfo.price.toFixed(2)}
                  </p>
                  <p className="font-instrument italic text-base mt-1" style={{ color: 'rgba(241,234,216,.65)' }}>
                    Cash on pickup
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Pickup windows */}
          <section className="col-span-12">
            <div className="rf-eyebrow mb-4">Available pickup windows</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {listing.pickupWindows.map((w, i) => {
                const start = new Date(w.start), end = new Date(w.end);
                const isPast = end < new Date();
                const isToday    = start.toDateString() === new Date().toDateString();
                const isTomorrow = start.toDateString() === new Date(Date.now() + 86400000).toDateString();
                return (
                  <div key={i} className="p-4 rounded-xl border flex items-start gap-4"
                       style={{
                         borderColor: 'rgba(241,234,216,.12)',
                         background: 'rgba(241,234,216,.025)',
                         opacity: isPast ? 0.4 : 1,
                       }}>
                    <span className="font-fraunces fraunces-wonk italic text-3xl font-light leading-none shrink-0"
                          style={{ color: 'var(--rf-sap)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <p className="font-fraunces text-base font-medium">
                        {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-70 mt-1">
                        {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {isPast && <p className="font-mono-jb text-[9px] uppercase tracking-[0.25em] mt-1.5"
                                   style={{ color: 'var(--rf-rust)' }}>passed</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </GeneratorLayout>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="rf-eyebrow mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function ListingStatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; label: string }> = {
    live:      { c: 'var(--rf-sap)', bg: 'rgba(200,255,77,.10)', label: 'Live' },
    reserved:  { c: 'var(--rf-amber)',       bg: 'rgba(233,196,106,.10)', label: 'Claimed' },
    completed: { c: 'var(--rf-sky)',       bg: 'rgba(108,180,241,.10)', label: 'Collected' },
  };
  const s = map[status] || { c: 'var(--rf-bone)', bg: 'rgba(241,234,216,.06)', label: status };
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.22em]"
          style={{ background: s.bg, color: s.c, border: `1px solid ${s.c}33` }}>
      <span className="size-1.5 rounded-full" style={{ background: s.c }} />
      {s.label}
    </span>
  );
}
