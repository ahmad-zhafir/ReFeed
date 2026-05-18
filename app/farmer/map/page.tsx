'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import MapView from '@/components/MapView';
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

export default function FarmerMapPage() {
  return (
    <RoleGuard allowedRoles={['farmer']}>
      <FarmerMapContent />
    </RoleGuard>
  );
}

function FarmerMapContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>([]);
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
    const unsub = onAuthStateChange(async (cu) => {
      if (cu) {
        setUser(cu);
        const profile = await getUserProfile(cu.uid);
        setUserProfile(profile);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const db = getFirestoreDb();
    const q = query(collection(db, getListingsCollectionPath()), where('status', '==', 'live'));
    const unsub = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceListing[]);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userProfile?.location?.latitude || !userProfile?.location?.longitude || !userProfile?.searchRadiusKm) {
      setFilteredListings(listings);
      return;
    }
    setFilteredListings(listings.filter((l) =>
      calculateDistance(userProfile.location!.latitude, userProfile.location!.longitude, l.latitude, l.longitude) <= (userProfile.searchRadiusKm || 10)
    ));
  }, [listings, userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          mapping the field<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  const mapListings = filteredListings.map((l) => ({
    id: l.id, donor_id: l.generatorUid, donor_name: l.generatorName,
    donor_contact: l.generatorContact, title: l.title,
    quantity: l.weightKg?.toString() || 'N/A', address: l.address,
    latitude: l.latitude, longitude: l.longitude, image_url: l.imageUrl,
    status: 'active' as const, created_at: l.createdAt,
  }));

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      <FarmerHeader
        userProfile={userProfile}
        active="map"
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef}
        router={router}
        extra={
          <Link href="/farmer"
                className="hidden sm:inline-flex items-center gap-2 px-4 h-9 rounded-full border font-mono-jb text-[10px] uppercase tracking-[0.25em] hover:bg-white/5 transition-colors"
                style={{ borderColor: 'rgba(241,234,216,.2)' }}>
            <span className="material-symbols-outlined text-base">view_list</span>
            List view
          </Link>
        }
      />

      {/* Caption strip above map */}
      <div className="border-b px-4 sm:px-6 lg:px-10 py-3 flex items-center justify-between"
           style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(241,234,216,.02)' }}>
        <div className="flex items-center gap-4">
          <span className="rf-eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
            Live field · plate &amp; pin
          </span>
          <span className="font-instrument italic text-base hidden md:inline-block"
                style={{ color: 'rgba(241,234,216,.65)' }}>
            {filteredListings.length} {filteredListings.length === 1 ? 'parcel' : 'parcels'} within your orbit
          </span>
        </div>
        <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden lg:block">
          Chapter 02 · The Cartography
        </span>
      </div>

      <div className="flex-1 relative" style={{ height: 'calc(100vh - 113px)' }}>
        <MapView
          listings={mapListings}
          onClaimListing={(listing) => {
            const m = filteredListings.find((l) => l.id === listing.id);
            if (m) router.push(`/farmer/listings/${m.id}`);
          }}
          currentUserId={user?.uid || null}
        />
      </div>
    </div>
  );
}
