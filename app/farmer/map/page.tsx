'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import MapView from '@/components/MapView';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const db = getFirestoreDb();
    const listingsRef = collection(db, getListingsCollectionPath());
    const q = query(listingsRef, where('status', '==', 'live'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketplaceListing[];
      setListings(listingsData);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userProfile?.location?.latitude || !userProfile?.location?.longitude || !userProfile?.searchRadiusKm) {
      setFilteredListings(listings);
      return;
    }

    const filtered = listings.filter((listing) => {
      const distance = calculateDistance(
        userProfile.location!.latitude,
        userProfile.location!.longitude,
        listing.latitude,
        listing.longitude
      );
      return distance <= (userProfile.searchRadiusKm || 10);
    });

    setFilteredListings(filtered);
  }, [listings, userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Convert MarketplaceListing to Listing format for MapView component
  const mapListings = filteredListings.map(l => ({
    id: l.id,
    donor_id: l.generatorUid,
    donor_name: l.generatorName,
    donor_contact: l.generatorContact,
    title: l.title,
    quantity: l.weightKg?.toString() || 'N/A',
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    image_url: l.imageUrl,
    status: 'active' as const,
    created_at: l.createdAt,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/farmer" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                ReFeed
              </h1>
            </Link>
            <Link
              href="/farmer"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              List View
            </Link>
          </div>
        </div>
      </header>

      <div className="h-[calc(100vh-80px)]">
        <MapView
          listings={mapListings}
          onClaimListing={(listing) => {
            const marketplaceListing = filteredListings.find(l => l.id === listing.id);
            if (marketplaceListing) {
              router.push(`/farmer/listings/${marketplaceListing.id}`);
            }
          }}
          currentUserId={user?.uid || null}
        />
      </div>
    </div>
  );
}

