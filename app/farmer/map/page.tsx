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
import { signOut } from '@/lib/firebase';
import toast from 'react-hot-toast';

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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

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
      <div className="min-h-screen bg-[#102213] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13ec37] mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
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
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen flex flex-col">
      {/* Top Navigation - Same as Dashboard */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#112214]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link href="/farmer" className="flex items-center gap-3 text-slate-900 dark:text-white cursor-pointer">
              <div className="size-8 text-[#13ec37]">
                <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
                </svg>
              </div>
              <h1 className="text-white text-lg font-bold tracking-tight hidden sm:block">ReFeed</h1>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex gap-6 mr-4">
                <Link href="/farmer" className="text-white font-medium text-sm hover:text-[#13ec37] transition-colors">
                  Marketplace
                </Link>
                <Link href="/schedule" className="text-[#92c99b] font-medium text-sm hover:text-white transition-colors">
                  Pickups
                </Link>
                <Link href="/orders" className="text-[#92c99b] font-medium text-sm hover:text-white transition-colors">
                  Orders
                </Link>
              </nav>
              <Link
                href="/farmer"
                className="px-4 py-2 bg-[#234829] hover:bg-[#32673b] text-white rounded-lg transition-colors font-medium text-sm border border-[#32673b]"
              >
                List View
              </Link>
              {userProfile && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-2 group"
                  >
                    <div className="bg-center bg-no-repeat bg-cover rounded-full size-9 ring-2 ring-[#234829] group-hover:ring-[#13ec37]/50 transition-all shadow-lg bg-gradient-to-br from-[#13ec37] to-green-400 flex items-center justify-center">
                      <span className="text-[#102213] font-bold text-sm">{userProfile?.name?.charAt(0).toUpperCase() || 'U'}</span>
                    </div>
                    <span className="material-symbols-outlined text-[#92c99b] text-sm hidden sm:block group-hover:text-white transition-colors">expand_more</span>
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#1c2e20] rounded-lg shadow-xl border border-[#234829] py-2 z-50">
                      <div className="px-4 py-3 border-b border-[#234829]">
                        <p className="text-sm font-semibold text-white">{userProfile.name}</p>
                        <p className="text-xs text-[#92c99b] mt-1">{userProfile.contact}</p>
                        {userProfile.email && (
                          <p className="text-xs text-[#92c99b] mt-1">{userProfile.email}</p>
                        )}
                      </div>
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        Settings
                      </Link>
                      <Link
                        href="/orders"
                        className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/schedule"
                        className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        Schedule
                      </Link>
                      <button
                        onClick={async () => {
                          try {
                            setProfileDropdownOpen(false);
                            await signOut();
                            await new Promise(resolve => setTimeout(resolve, 100));
                            router.push('/');
                          } catch (error: any) {
                            console.error('Logout error:', error);
                            toast.error('Failed to sign out. Please try again.');
                          }
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-[#234829] transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">logout</span>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 h-[calc(100vh-64px)]">
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

