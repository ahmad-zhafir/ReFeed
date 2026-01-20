'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser, getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, runTransaction, Timestamp, collection } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, MarketplaceOrder, MarketplacePickupWindow, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { signOut } from '@/lib/firebase';

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        await loadListing();
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, listingId]);

  const loadListing = async () => {
    try {
      const db = getFirestoreDb();
      const listingDoc = await getDoc(doc(db, getListingsCollectionPath(), listingId));
      
      if (!listingDoc.exists()) {
        toast.error('Listing not found');
        router.push('/farmer');
        return;
      }

      const listingData = { id: listingDoc.id, ...listingDoc.data() } as MarketplaceListing;
      
      if (listingData.status !== 'live') {
        toast.error('This listing is no longer available');
        router.push('/farmer');
        return;
      }

      setListing(listingData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading listing:', error);
      toast.error('Failed to load listing');
      router.push('/farmer');
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedWindow || !user || !listing) {
      toast.error('Please select a pickup window');
      return;
    }

    setSubmitting(true);
    try {
      const db = getFirestoreDb();
      const listingRef = doc(db, getListingsCollectionPath(), listingId);

      // FCFS Transaction: Atomically check status and reserve
      await runTransaction(db, async (transaction) => {
        const listingDoc = await transaction.get(listingRef);
        
        if (!listingDoc.exists()) {
          throw new Error('Listing not found');
        }

        const currentListing = listingDoc.data() as MarketplaceListing;
        
        if (currentListing.status !== 'live') {
          throw new Error('Listing is no longer available');
        }

        // Reserve the listing
        transaction.update(listingRef, {
          status: 'reserved',
          reservedBy: user.uid,
          reservedAt: Timestamp.now(),
          scheduledWindow: selectedWindow,
        });

        // Create order
        const ordersRef = collection(db, getOrdersCollectionPath());
        const orderData: Omit<MarketplaceOrder, 'id'> = {
          listingId: listing.id,
          generatorUid: listing.generatorUid,
          farmerUid: user.uid,
          scheduledWindow: selectedWindow,
          paymentMethod: 'cash',
          status: 'reserved',
          price: listing.price,
          currency: listing.currency,
          title: listing.title,
          category: listing.category,
          imageUrl: listing.imageUrl,
          address: listing.address,
          latitude: listing.latitude,
          longitude: listing.longitude,
          createdAt: Timestamp.now(),
        };

        transaction.set(doc(ordersRef), orderData);
      });

      toast.success('Purchase confirmed! Check your orders for pickup details.');
      router.push('/orders');
    } catch (error: any) {
      console.error('Transaction error:', error);
      toast.error(error.message || 'Failed to confirm purchase. Listing may have been taken.');
    } finally {
      setSubmitting(false);
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
          href={`/farmer/listings/${listingId}`}
          className="flex items-center gap-2 text-[#92c99b] text-sm font-medium hover:text-white transition-colors w-fit mb-6"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Listing
        </Link>

        <div className="bg-white dark:bg-[#1c2e20] rounded-xl shadow-lg p-8 border border-gray-200 dark:border-[#234829]">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Confirm Purchase</h2>

          {/* Listing Summary */}
          <div className="border-b border-gray-200 dark:border-[#234829] pb-6 mb-6">
            <div className="flex gap-4">
              <img src={listing.imageUrl} alt={listing.title} className="w-32 h-32 object-cover rounded-lg" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{listing.title}</h3>
                <p className="text-sm text-gray-600 dark:text-[#92c99b] mt-1">{listing.category}</p>
                <p className="text-sm text-gray-600 dark:text-[#92c99b] mt-1">{listing.address}</p>
                {listing.weightKg && (
                  <p className="text-sm text-gray-600 dark:text-[#92c99b] mt-1">Weight: ~{listing.weightKg} kg</p>
                )}
                <p className="text-2xl font-bold text-emerald-600 dark:text-[#13ec37] mt-2">
                  {listing.currency} {listing.price.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#92c99b] mt-1">Payment: Cash on pickup</p>
              </div>
            </div>
          </div>

          {/* Pickup Window Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Select Pickup Window</h3>
            <div className="space-y-2">
              {listing.pickupWindows.map((window, index) => {
                const now = new Date();
                const windowStart = new Date(window.start);
                const isPast = windowStart < now;

                return (
                  <button
                    key={index}
                    onClick={() => !isPast && setSelectedWindow(window)}
                    disabled={isPast}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isPast
                        ? 'border-gray-200 dark:border-[#234829] bg-gray-50 dark:bg-[#112214] opacity-60 cursor-not-allowed'
                        : selectedWindow === window
                        ? 'border-[#13ec37] bg-[#13ec37]/10 dark:bg-[#13ec37]/20'
                        : 'border-gray-200 dark:border-[#234829] bg-gray-50 dark:bg-[#112214] hover:border-[#13ec37]/50'
                    }`}
                  >
                    <p className={`font-semibold ${isPast ? 'text-gray-500 dark:text-[#5d8265]' : 'text-slate-900 dark:text-white'}`}>
                      {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                      {isPast && <span className="ml-2 text-xs">(Past)</span>}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {selectedWindow && (
            <div className="bg-gray-50 dark:bg-[#112214] rounded-lg p-4 mb-6 border border-gray-200 dark:border-[#234829]">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Order Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-[#92c99b]">Item:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{listing.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-[#92c99b]">Price:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{listing.currency} {listing.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-[#92c99b]">Pickup:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {new Date(selectedWindow.start).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-[#234829]">
                  <span className="text-slate-900 dark:text-white font-bold">Total:</span>
                  <span className="text-emerald-600 dark:text-[#13ec37] font-bold text-lg">
                    {listing.currency} {listing.price.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <Link
              href={`/farmer/listings/${listingId}`}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-[#234829] text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-[#32673b] transition-all font-semibold text-center border dark:border-[#32673b]"
            >
              Cancel
            </Link>
            <button
              onClick={handleConfirmPurchase}
              disabled={!selectedWindow || submitting}
              className="flex-1 px-6 py-3 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg transition-all shadow-md hover:shadow-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#112214]"></div>
                  Processing...
                </>
              ) : (
                <>
                  Confirm Purchase
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

