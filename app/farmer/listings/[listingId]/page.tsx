'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange, signOut } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
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
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        await loadListing(profile);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, listingId]);

  const loadListing = async (profile: UserProfile | null) => {
    try {
      const db = getFirestoreDb();
      const listingDoc = await getDoc(doc(db, getListingsCollectionPath(), listingId));

      if (!listingDoc.exists()) {
        toast.error('Listing not found');
        router.push('/farmer');
        return;
      }

      const listingData = { id: listingDoc.id, ...listingDoc.data() } as MarketplaceListing;
      setListing(listingData);

      if (profile?.location?.latitude && profile?.location?.longitude) {
        const dist = calculateDistance(
          profile.location.latitude,
          profile.location.longitude,
          listingData.latitude,
          listingData.longitude
        );
        setDistance(dist);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading listing:', error);
      toast.error('Failed to load listing');
      router.push('/farmer');
    }
  };

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

  if (!listing) {
    return null;
  }

  if (listing.status !== 'live') {
    return (
      <div className="min-h-screen bg-[#102213] flex items-center justify-center">
        <div className="bg-[#1c2e20] border border-[#234829] rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Listing Not Available</h2>
          <p className="text-[#92c99b] mb-6">This listing is no longer available for purchase.</p>
          <Link href="/farmer" className="px-6 py-3 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg font-bold transition-colors">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen flex flex-col">
      {/* Top Navigation - Same as Dashboard */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#112214]/95 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8">
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

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/farmer"
          className="flex items-center gap-2 text-[#92c99b] text-sm font-medium hover:text-white transition-colors w-fit mb-6"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Marketplace
        </Link>

        <div className="bg-white dark:bg-[#1c2e20] rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-[#234829]">
          {/* Image Gallery */}
          <div className="relative w-full h-64 md:h-96 bg-gray-100 dark:bg-[#102213]">
            {listing.imageUrls && listing.imageUrls.length > 0 ? (
              <>
                <img
                  src={listing.imageUrls[selectedImageIndex] || listing.imageUrl}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = listing.imageUrl || 'https://via.placeholder.com/800x400';
                  }}
                />
                {listing.imageUrls.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImageIndex((prev) => (prev > 0 ? prev - 1 : listing.imageUrls!.length - 1))}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <button
                      onClick={() => setSelectedImageIndex((prev) => (prev < listing.imageUrls!.length - 1 ? prev + 1 : 0))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {listing.imageUrls.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${selectedImageIndex === index
                              ? 'bg-white w-8'
                              : 'bg-white/50 hover:bg-white/75'
                            }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/800x400';
                }}
              />
            )}
          </div>

          {/* Thumbnail Gallery */}
          {listing.imageUrls && listing.imageUrls.length > 1 && (
            <div className="flex gap-2 p-4 bg-gray-50 dark:bg-[#112214] overflow-x-auto border-b border-gray-200 dark:border-[#234829]">
              {[listing.imageUrl, ...listing.imageUrls].map((url, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(Math.max(0, index - 1))}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${(index === 0 && selectedImageIndex === 0) || (index > 0 && selectedImageIndex === index - 1)
                      ? 'border-[#13ec37]'
                      : 'border-transparent hover:border-[#234829]'
                    }`}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{listing.title}</h1>
                <span className="px-3 py-1 bg-green-100 dark:bg-[#234829] text-green-700 dark:text-[#13ec37] rounded-full text-sm font-semibold border dark:border-[#32673b]">
                  {listing.category}
                </span>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600 dark:text-[#13ec37]">
                  {listing.currency} {listing.price.toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 dark:text-[#92c99b] mt-1">Cash on pickup</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#92c99b] mb-1">Location</h3>
                <p className="text-gray-900 dark:text-white">{listing.address}</p>
                {distance !== null && (
                  <p className="text-sm text-gray-600 dark:text-[#92c99b] mt-1">{distance.toFixed(1)} km away</p>
                )}
              </div>
              {listing.weightKg && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-[#92c99b] mb-1">Weight</h3>
                  <p className="text-gray-900 dark:text-white">~{listing.weightKg} kg</p>
                </div>
              )}
              {listing.expiryAt && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-[#92c99b] mb-1">Expiry</h3>
                  <p className="text-gray-900 dark:text-white">{new Date(listing.expiryAt).toLocaleDateString()}</p>
                </div>
              )}
              {listing.generatorName && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-[#92c99b] mb-1">Generator</h3>
                  <p className="text-gray-900 dark:text-white">{listing.generatorName}</p>
                </div>
              )}
            </div>

            {listing.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-[#92c99b] mb-2">Notes</h3>
                <p className="text-gray-900 dark:text-white">{listing.notes}</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[#92c99b] mb-2">Available Pickup Windows</h3>
              <div className="space-y-2">
                {listing.pickupWindows.map((window, index) => {
                  const now = new Date();
                  const windowStart = new Date(window.start);
                  const isPast = windowStart < now;

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${isPast
                          ? 'bg-gray-50 dark:bg-[#112214] border-gray-200 dark:border-[#234829] opacity-60'
                          : 'bg-gray-50 dark:bg-[#112214] border-gray-200 dark:border-[#234829]'
                        }`}
                    >
                      <p className="text-gray-900 dark:text-white">
                        {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/farmer"
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-[#234829] text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-[#32673b] transition-all font-semibold text-center border dark:border-[#32673b]"
              >
                Back
              </Link>
              <Link
                href={`/farmer/checkout/${listingId}`}
                className="flex-1 px-6 py-3 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg transition-all shadow-md hover:shadow-lg font-bold text-center flex items-center justify-center gap-2"
              >
                Buy Now (FCFS)
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}