'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FarmerHeader } from '@/components/FarmerHeader';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ListingDetailPage() {
  return (
    <RoleGuard allowedRoles={['farmer']}>
      <ListingDetailContent />
    </RoleGuard>
  );
}

function ListingDetailContent() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.listingId as string;

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
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
    const unsub = onAuthStateChange(async (user) => {
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        await loadListing(profile);
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router, listingId]);

  const loadListing = async (profile: UserProfile | null) => {
    try {
      const db = getFirestoreDb();
      const ld = await getDoc(doc(db, getListingsCollectionPath(), listingId));
      if (!ld.exists()) {
        toast.error('Listing not found');
        router.push('/farmer');
        return;
      }
      const data = { id: ld.id, ...ld.data() } as MarketplaceListing;
      setListing(data);
      if (profile?.location?.latitude && profile?.location?.longitude) {
        setDistance(calculateDistance(
          profile.location.latitude, profile.location.longitude,
          data.latitude, data.longitude
        ));
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load listing');
      router.push('/farmer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          examining the parcel<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }
  if (!listing) return null;

  if (listing.status !== 'live') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
        <FarmerHeader userProfile={userProfile} active="marketplace"
          profileDropdownOpen={profileDropdownOpen} setProfileDropdownOpen={setProfileDropdownOpen}
          dropdownRef={dropdownRef} router={router} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md text-center rounded-2xl p-10 border"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
            <div className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none mb-4"
                 style={{ color: 'var(--rf-rust)' }}>ø</div>
            <h2 className="font-fraunces text-3xl font-medium mb-2">Already claimed.</h2>
            <p className="font-instrument italic text-lg mb-8" style={{ color: 'rgba(241,234,216,.65)' }}>
              Another farmer beat you to this one — the loop closes quickly.
            </p>
            <Link href="/farmer"
                  className="inline-flex items-center gap-3 pl-6 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em]"
                  style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
              <span>Back to gather</span>
              <span className="flex items-center justify-center size-9 rounded-full"
                    style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>→</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allImages = listing.imageUrls && listing.imageUrls.length > 0 ? listing.imageUrls : [listing.imageUrl];
  const currentImg = allImages[selectedImageIndex] || listing.imageUrl;

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
        <Link href="/farmer"
              className="inline-flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] mb-8">
          <span aria-hidden>←</span> Back to gather
        </Link>

        {/* Editorial header */}
        <div className="flex items-center justify-between mb-6">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
            Specimen №{listing.id?.slice(0, 6).toUpperCase() || '------'}
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            pp. 01 — The parcel
          </span>
        </div>

        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-10">
          {listing.title}
        </h1>

        {/* Two-column layout */}
        <div className="grid grid-cols-12 gap-x-8 gap-y-10">
          {/* —— Image gallery —— */}
          <div className="col-span-12 lg:col-span-7">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'var(--rf-moss)' }}>
              <img src={currentImg} alt={listing.title}
                   className="w-full h-full object-cover"
                   onError={(e) => {
                     const t = e.target as HTMLImageElement;
                     t.src = listing.imageUrl || 'https://via.placeholder.com/800x600';
                   }} />
              {/* Top-left specimen mark */}
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full backdrop-blur-md border font-mono-jb text-[10px] uppercase tracking-[0.25em]"
                   style={{ background: 'rgba(13,26,16,.6)', borderColor: 'rgba(241,234,216,.18)', color: 'var(--rf-bone)' }}>
                {allImages.length > 1 ? `${selectedImageIndex + 1} / ${allImages.length}` : 'plate · I'}
              </div>
              {allImages.length > 1 && (
                <>
                  <button onClick={() => setSelectedImageIndex((p) => p > 0 ? p - 1 : allImages.length - 1)}
                          aria-label="Previous"
                          className="absolute left-4 top-1/2 -translate-y-1/2 size-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all hover:bg-white/10"
                          style={{ background: 'rgba(13,26,16,.6)', borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button onClick={() => setSelectedImageIndex((p) => p < allImages.length - 1 ? p + 1 : 0)}
                          aria-label="Next"
                          className="absolute right-4 top-1/2 -translate-y-1/2 size-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all hover:bg-white/10"
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

          {/* —— Details column —— */}
          <div className="col-span-12 lg:col-span-5">
            <div className="rounded-2xl p-7 border space-y-7"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>

              {/* Price */}
              <div className="flex items-baseline justify-between border-b pb-5"
                   style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                <div>
                  <p className="rf-eyebrow mb-1">Price · cash on pickup</p>
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

              {/* Spec rows */}
              <SpecRow label="01 · Location" hint={distance !== null ? `${distance.toFixed(1)} km away` : undefined}>
                <p className="font-fraunces text-base leading-snug">{listing.address}</p>
              </SpecRow>

              {listing.weightKg && (
                <SpecRow label="02 · Weight">
                  <p className="font-fraunces fraunces-wonk italic text-3xl font-light"
                     style={{ color: 'var(--rf-bone)' }}>
                    ~{listing.weightKg}<span className="font-mono-jb text-xs ml-1 not-italic opacity-60">kg</span>
                  </p>
                </SpecRow>
              )}

              {listing.expiryAt && (
                <SpecRow label="03 · Use by">
                  <p className="font-fraunces text-base">
                    {new Date(listing.expiryAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </SpecRow>
              )}

              {listing.generatorName && (
                <SpecRow label="04 · Kitchen">
                  <p className="font-instrument italic text-xl" style={{ color: 'var(--rf-bone)' }}>
                    {listing.generatorName}
                  </p>
                </SpecRow>
              )}
            </div>

            {/* CTA */}
            <div className="flex gap-3 mt-6">
              <Link href="/farmer"
                    className="flex-1 inline-flex items-center justify-center h-14 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                    style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                ← Keep looking
              </Link>
              <Link href={`/farmer/checkout/${listingId}`}
                    className="group flex-[1.5] inline-flex items-center justify-between pl-6 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                    style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                <span>Claim — FCFS</span>
                <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                      style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>

          {/* —— Notes & windows row —— */}
          {listing.notes && (
            <section className="col-span-12 lg:col-span-7 rf-fade-up">
              <div className="rf-eyebrow mb-3">§ Field notes</div>
              <p className="font-instrument italic text-2xl leading-snug"
                 style={{ color: 'rgba(241,234,216,.8)' }}>
                &ldquo;{listing.notes}&rdquo;
              </p>
            </section>
          )}

          <section className="col-span-12 lg:col-span-5 rf-fade-up">
            <div className="rf-eyebrow mb-4">Available pickup windows</div>
            <div className="space-y-2">
              {listing.pickupWindows.map((w, i) => {
                const start = new Date(w.start);
                const end = new Date(w.end);
                const isPast = end < new Date();
                return (
                  <div key={i}
                       className="px-4 py-3 rounded-xl border flex items-start gap-3"
                       style={{
                         borderColor: 'rgba(241,234,216,.12)',
                         background: 'rgba(241,234,216,.025)',
                         opacity: isPast ? 0.4 : 1,
                       }}>
                    <span className="font-fraunces fraunces-wonk italic text-2xl font-light leading-none shrink-0"
                          style={{ color: 'var(--rf-sap)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <p className="font-fraunces text-base leading-tight">
                        {start.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60 mt-0.5">
                        → {end.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {isPast && <p className="font-mono-jb text-[9px] uppercase tracking-[0.25em] mt-1" style={{ color: 'var(--rf-rust)' }}>passed</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SpecRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="rf-eyebrow">{label}</span>
        {hint && <span className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
