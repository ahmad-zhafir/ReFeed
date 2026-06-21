'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { MarketplaceListing, Rating, UserProfile } from '@/lib/types';
import { getRatingsCollectionPath, getListingsCollectionPath } from '@/lib/constants';
import { getUserProfile } from '@/lib/userProfile';
import RoleGuard from '@/components/RoleGuard';
import RatingDisplay from '@/components/RatingDisplay';
import { FarmerHeader } from '@/components/FarmerHeader';
import toast from 'react-hot-toast';

export default function VendorRatingPage() {
  return (
    <RoleGuard allowedRoles={['farmer']}>
      <VendorRatingContent />
    </RoleGuard>
  );
}

function VendorRatingContent() {
  const router = useRouter();
  const params = useParams();
  const vendorUid = params.vendorUid as string;

  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [vendorProfile, setVendorProfile] = useState<UserProfile | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [reviewerProfiles, setReviewerProfiles] = useState<Record<string, UserProfile>>({});
  const [liveListings, setLiveListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
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
    const unsub = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile(vendorUid);
        if (!cancelled) setVendorProfile(profile);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error('Failed to load vendor profile');
          router.push('/farmer');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, vendorUid]);

  useEffect(() => {
    if (!vendorUid) return;
    const db = getFirestoreDb();
    const ratingsQuery = query(collection(db, getRatingsCollectionPath()), where('generatorUid', '==', vendorUid));
    const unsubscribeRatings = onSnapshot(
      ratingsQuery,
      async (snapshot) => {
        const nextRatings = snapshot.docs
          .map((docSnap) => ({ ...(docSnap.data() as Rating), id: docSnap.id }))
          .filter((item) => typeof item.rating === 'number') as Rating[];
        nextRatings.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRatings(nextRatings);

        const reviewerUids = Array.from(new Set(nextRatings.map((rating) => rating.farmerUid).filter(Boolean)));
        const profileMap: Record<string, UserProfile> = {};
        for (const uid of reviewerUids) {
          try {
            const profile = await getUserProfile(uid);
            if (profile) profileMap[uid] = profile;
          } catch (error) {
            console.error(`Failed to load reviewer profile for ${uid}`, error);
          }
        }
        setReviewerProfiles(profileMap);
      },
      (error) => {
        console.error(error);
        toast.error('Failed to load vendor ratings');
      },
    );

    const listingsQuery = query(
      collection(db, getListingsCollectionPath()),
      where('generatorUid', '==', vendorUid),
    );
    const unsubscribeListings = onSnapshot(
      listingsQuery,
      (snapshot) => {
        const nextListings = snapshot.docs
          .map((docSnap) => ({ ...(docSnap.data() as MarketplaceListing), id: docSnap.id }))
          .filter((listing) => listing.status === 'live') as MarketplaceListing[];
        nextListings.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setLiveListings(nextListings);
      },
      (error) => console.error(error),
    );

    return () => {
      unsubscribeRatings();
      unsubscribeListings();
    };
  }, [vendorUid]);

  const ratingStats = useMemo(() => {
    const total = ratings.length;
    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    const average = total > 0 ? sum / total : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => {
      const count = ratings.filter((rating) => rating.rating === star).length;
      return { star, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 };
    });
    return {
      total,
      average,
      distribution,
    };
  }, [ratings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          viewing the vendor ledger<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col relative"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
      <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />

      <FarmerHeader
        userProfile={userProfile}
        active="marketplace"
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef}
        router={router}
        extra={
          <Link
            href="/farmer"
            className="hidden sm:inline-flex items-center gap-2 px-4 h-9 rounded-full border font-mono-jb text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-colors"
            style={{ borderColor: 'rgba(241,234,216,.2)' }}
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to gather
          </Link>
        }
      />

      <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">
        <Link
          href="/farmer"
          className="inline-flex items-center gap-2 font-mono-jb text-[11px] uppercase tracking-[0.25em] opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] mb-8"
        >
          <span aria-hidden>←</span> Back to gather
        </Link>

        <section className="grid grid-cols-12 gap-6 mb-12 rf-fade-up">
          <div className="col-span-12 lg:col-span-8">
            <div className="rf-eyebrow mb-3">Vendor rating</div>
            <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)]">
              {vendorProfile?.name || 'Vendor'}
            </h1>
            <p className="font-instrument italic text-xl mt-4 max-w-2xl" style={{ color: 'rgba(241,234,216,.72)' }}>
              Review history and performance snapshot for this food vendor.
            </p>
          </div>

          <div className="col-span-12 lg:col-span-4 rounded-2xl p-6 border self-start"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="rf-eyebrow mb-1">Average rating</p>
                <RatingDisplay rating={ratingStats.average} totalRatings={ratingStats.total} size="lg" />
              </div>
              <div className="text-right">
                <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60">Live listings</p>
                <p className="font-fraunces fraunces-wonk text-4xl font-light" style={{ color: 'var(--rf-sap)' }}>
                  {liveListings.length}
                </p>
              </div>
            </div>

            {vendorProfile?.contact && (
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                <p className="rf-eyebrow mb-1">Contact</p>
                <p className="font-instrument italic text-lg">{vendorProfile.contact}</p>
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-12 gap-6 mb-12 rf-fade-up" style={{ animationDelay: '.08s' }}>
          <div className="col-span-12 lg:col-span-5 rounded-2xl p-6 border"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="rf-eyebrow mb-1">Rating breakdown</p>
                <h2 className="font-fraunces text-2xl font-medium">Star distribution</h2>
              </div>
              <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60">
                {ratingStats.total} {ratingStats.total === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            <div className="space-y-3">
              {ratingStats.distribution.map((entry) => (
                <div key={entry.star} className="grid grid-cols-[56px_1fr_38px] items-center gap-3">
                  <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-70">
                    {entry.star} star
                  </span>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(241,234,216,.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${entry.percent}%`, background: 'var(--rf-sap)' }}
                    />
                  </div>
                  <span className="font-fraunces text-base text-right">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 rounded-2xl p-6 border"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="rf-eyebrow mb-1">Recent reviews</p>
                <h2 className="font-fraunces text-2xl font-medium">What farmers said</h2>
              </div>
              <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60">
                Latest first
              </span>
            </div>

            {ratings.length === 0 ? (
              <div className="rounded-xl p-5 border" style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(13,26,16,.35)' }}>
                <p className="font-fraunces text-lg">No ratings yet.</p>
                <p className="font-instrument italic text-base mt-1" style={{ color: 'rgba(241,234,216,.65)' }}>
                  This vendor has not received any feedback yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating) => {
                  const reviewerName = reviewerProfiles[rating.farmerUid]?.name || 'Anonymous farmer';
                  const createdAt = rating.createdAt?.toDate?.();
                  return (
                    <article
                      key={rating.id}
                      className="rounded-xl p-5 border"
                      style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(13,26,16,.35)' }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                        <div>
                          <p className="font-fraunces text-lg font-medium">{reviewerName}</p>
                          <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1">
                            {createdAt ? createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recently'}
                          </p>
                        </div>
                        <RatingDisplay rating={rating.rating} size="sm" showCount={false} />
                      </div>

                      {rating.comment ? (
                        <p className="font-instrument italic text-lg leading-snug" style={{ color: 'rgba(241,234,216,.8)' }}>
                          &ldquo;{rating.comment}&rdquo;
                        </p>
                      ) : (
                        <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60">
                          No comment provided.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {liveListings.length > 0 && (
          <section className="rf-fade-up" style={{ animationDelay: '.16s' }}>
            <div className="flex items-end justify-between mb-5">
              <div>
                <p className="rf-eyebrow mb-1">Current supply</p>
                <h2 className="font-fraunces text-2xl font-medium">Live listings from this vendor</h2>
              </div>
              <Link
                href="/farmer"
                className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-70 hover:text-[color:var(--rf-sap)]"
              >
                Browse all →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {liveListings.slice(0, 6).map((listing) => (
                <Link
                  key={listing.id}
                  href={`/farmer/listings/${listing.id}`}
                  className="rounded-2xl p-5 border transition-all hover:-translate-y-0.5 hover:bg-white/[0.02]"
                  style={{ borderColor: 'rgba(241,234,216,.12)', background: 'rgba(241,234,216,.025)' }}
                >
                  <p className="font-fraunces text-lg font-medium mb-2 truncate">{listing.title}</p>
                  <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 truncate">
                    {listing.address}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}