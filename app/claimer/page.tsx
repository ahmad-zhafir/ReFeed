'use client';

import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, getFirestoreDb, signOut, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Listing, UserProfile, Claim } from '@/lib/types';
import { getListingsCollectionPath, getClaimsCollectionPath } from '@/lib/constants';
import { getUserProfile } from '@/lib/userProfile';
import MapView from '@/components/MapView';
import ClaimModal from '@/components/ClaimModal';
import MyClaimCard from '@/components/MyClaimCard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ClaimerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [allClaims, setAllClaims] = useState<Claim[]>([]); // All claims to calculate remaining quantity
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedListingForClaim, setSelectedListingForClaim] = useState<Listing | null>(null);
  const listingsProcessedRef = useRef<Set<string>>(new Set());
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mapKey, setMapKey] = useState(0);
  const [isMapReady, setIsMapReady] = useState(true);

  // Force map remount when pathname changes (navigation)
  useEffect(() => {
    setIsMapReady(false);
    setMapKey(prev => prev + 1);
    // Small delay to ensure component unmounts before remounting
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 150);
    return () => clearTimeout(timer);
  }, [pathname]);

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

  // Debug: Log listings whenever they change to detect duplicates
  useEffect(() => {
    const ids = listings.map(l => l.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      console.error('DUPLICATE LISTINGS DETECTED IN STATE:', {
        total: ids.length,
        unique: uniqueIds.size,
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
        listings: listings.map(l => ({ id: l.id, title: l.title, donor_id: l.donor_id }))
      });
    }
  }, [listings]);

  // Close dropdown when clicking outside
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
    if (!user) return;

    try {
      const db = getFirestoreDb();
      const listingsRef = collection(db, getListingsCollectionPath());
      const claimsRef = collection(db, getClaimsCollectionPath());

      // Real-time subscription for active listings
      const q = query(listingsRef, where('status', '==', 'active'));
      const unsubscribeListings = onSnapshot(q, async (snapshot) => {
        // First, deduplicate at the Firestore document level - keep only one doc per ID
        const docMap = new Map<string, typeof snapshot.docs[0]>();
        snapshot.docs.forEach((doc) => {
          // Always keep the first occurrence, or prefer one with donor_id if user is donor
          if (!docMap.has(doc.id)) {
            docMap.set(doc.id, doc);
          } else {
            // If we already have this ID, check if current doc has better donor_id match
            const existing = docMap.get(doc.id)!;
            const existingData = existing.data();
            const currentData = doc.data();
            const isUserDonor = user?.uid && currentData.donor_id === user.uid;
            const existingIsUserDonor = user?.uid && existingData.donor_id === user.uid;
            
            // Prefer the one that correctly identifies user as donor
            if (isUserDonor && !existingIsUserDonor) {
              docMap.set(doc.id, doc);
            }
          }
        });

        const activeListings = Array.from(docMap.values()).map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Listing[];

        // Calculate remaining quantity for each listing based on all claims
        const updatedListings = await Promise.all(
          activeListings.map(async (listing) => {
            // Get all claims for this listing
            const listingClaimsQuery = query(claimsRef, where('listing_id', '==', listing.id));
            const claimsSnapshot = await getDocs(listingClaimsQuery);
            const listingClaims = claimsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Claim[];

            // Calculate total claimed
            const originalQuantity = listing.quantity || '0';
            const quantityUnit = originalQuantity.replace(/[0-9.\s]/g, '').trim() || '';
            const originalQuantityNum = parseFloat(originalQuantity.replace(/[^0-9.]/g, '')) || 0;

            let totalClaimedNum = 0;
            listingClaims.forEach((claim) => {
              const claimNum = parseFloat(claim.quantity.replace(/[^0-9.]/g, '')) || 0;
              totalClaimedNum += claimNum;
            });

            const remainingNum = Math.max(0, originalQuantityNum - totalClaimedNum);
            const remainingQuantity = remainingNum > 0 
              ? `${remainingNum}${quantityUnit ? ' ' + quantityUnit : ''}` 
              : '0';

            return {
              ...listing,
              remaining_quantity: remainingQuantity,
            };
          })
        );

        // Filter out listings with 0 remaining quantity
        const filteredListings = updatedListings.filter((listing) => {
          const remainingNum = parseFloat((listing.remaining_quantity || '0').replace(/[^0-9.]/g, '')) || 0;
          return remainingNum > 0;
        });

        // Deduplicate by ID using Map - always keep only one instance per ID
        // If user is the donor, prefer the version that correctly identifies them as donor
        const listingsMap = new Map<string, Listing>();
        filteredListings.forEach((listing) => {
          if (!listing.id) return; // Skip listings without ID
          
          const existing = listingsMap.get(listing.id);
          if (!existing) {
            // First time seeing this listing ID - add it
            listingsMap.set(listing.id, listing);
          } else {
            // Duplicate found - prefer the one that correctly identifies user as donor if applicable
            const isUserDonor = user?.uid && listing.donor_id === user.uid;
            const existingIsUserDonor = user?.uid && existing.donor_id === user.uid;
            
            // If current listing correctly identifies user as donor, use it
            // Otherwise, if existing doesn't have donor_id but current does, use current
            // Otherwise, keep existing
            if (isUserDonor && !existingIsUserDonor) {
              listingsMap.set(listing.id, listing);
            } else if (!existing.donor_id && listing.donor_id) {
              listingsMap.set(listing.id, listing);
            }
            // Otherwise keep existing (don't update)
          }
        });

        const uniqueListings = Array.from(listingsMap.values());
        
        // Final safety check: ensure no duplicates by ID and correct donor_id
        const finalListingsMap = new Map<string, Listing>();
        uniqueListings.forEach((listing) => {
          if (!listing.id) return;
          
          const existing = finalListingsMap.get(listing.id);
          if (!existing) {
            finalListingsMap.set(listing.id, listing);
          } else {
            // If user is donor, ensure we keep the version with correct donor_id
            const isUserDonor = user?.uid && listing.donor_id === user.uid;
            const existingIsUserDonor = user?.uid && existing.donor_id === user.uid;
            
            if (isUserDonor && !existingIsUserDonor) {
              finalListingsMap.set(listing.id, listing);
            } else if (!existing.donor_id && listing.donor_id) {
              finalListingsMap.set(listing.id, listing);
            }
            // Otherwise keep existing
          }
        });
        
        const finalListings = Array.from(finalListingsMap.values());
        
        // One more pass to ensure absolute uniqueness by ID
        const absolutelyUniqueListings: Listing[] = [];
        const finalSeenIds = new Set<string>();
        finalListings.forEach((listing) => {
          if (listing.id && !finalSeenIds.has(listing.id)) {
            finalSeenIds.add(listing.id);
            absolutelyUniqueListings.push(listing);
          } else if (listing.id && finalSeenIds.has(listing.id)) {
            // Duplicate detected - log for debugging
            console.warn('Duplicate listing detected:', listing.id, listing.title);
          }
        });
        
        // Final absolute uniqueness check using Set
        const finalUniqueMap = new Map<string, Listing>();
        absolutelyUniqueListings.forEach((listing) => {
          if (!listing.id) return;
          
          // If we haven't seen this ID, add it
          if (!finalUniqueMap.has(listing.id)) {
            finalUniqueMap.set(listing.id, listing);
          } else {
            // If we've seen it, prefer the one with correct donor_id if user is donor
            const existing = finalUniqueMap.get(listing.id)!;
            const isUserDonor = user?.uid && listing.donor_id === user.uid;
            const existingIsUserDonor = user?.uid && existing.donor_id === user.uid;
            
            if (isUserDonor && !existingIsUserDonor) {
              finalUniqueMap.set(listing.id, listing);
            }
          }
        });
        
        const finalUniqueListings = Array.from(finalUniqueMap.values());
        
        // Verify no duplicates exist
        const ids = finalUniqueListings.map(l => l.id).filter(Boolean);
        const uniqueIds = new Set(ids);
        
        if (ids.length !== uniqueIds.size) {
          console.error('CRITICAL: Duplicates still exist!', {
            total: ids.length,
            unique: uniqueIds.size,
            duplicates: ids.filter((id, index) => ids.indexOf(id) !== index)
          });
        }
        
        // Only update state if we have truly unique listings
        // Also check if the IDs are different from current state to avoid unnecessary updates
        const currentIds = new Set(listings.map(l => l.id));
        const newIds = new Set(finalUniqueListings.map(l => l.id));
        const idsChanged = currentIds.size !== newIds.size || 
          !Array.from(newIds).every(id => currentIds.has(id));
        
        if (idsChanged || finalUniqueListings.length !== listings.length) {
          setListings(finalUniqueListings);
        } else {
          // Even if IDs are same, update if any listing data changed (e.g., remaining_quantity)
          setListings(finalUniqueListings);
        }
      });

      // Load all claims (for calculating remaining quantities)
      const unsubscribeAllClaims = onSnapshot(claimsRef, (snapshot) => {
        const allClaimsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Claim[];
        setAllClaims(allClaimsData);
      });

      // Load my claims
      const myClaimsQuery = query(claimsRef, where('claimer_id', '==', user.uid));
      const unsubscribeMyClaims = onSnapshot(myClaimsQuery, async (snapshot) => {
        const claimsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Claim[];

        setMyClaims(claimsData);
      });

      return () => {
        unsubscribeListings();
        unsubscribeAllClaims();
        unsubscribeMyClaims();
      };
    } catch (error) {
      console.error('Error setting up Firestore subscription:', error);
    }
  }, [user]);

  const handleClaimClick = (listing: Listing) => {
    // Check if user is the donor
    if (listing.donor_id === user?.uid) {
      toast.error('You cannot claim your own donation!');
      return;
    }

    setSelectedListingForClaim(listing);
    setClaimModalOpen(true);
  };

  const handleClaimListing = async (listingId: string, claimQuantity: string) => {
    if (!user || !userProfile) return;

    try {
      const db = getFirestoreDb();
      const listingRef = doc(db, getListingsCollectionPath(), listingId);
      const claimsRef = collection(db, getClaimsCollectionPath());

      // Get the current listing to check if user is donor
      const listing = listings.find(l => l.id === listingId);
      if (listing && listing.donor_id === user.uid) {
        toast.error('You cannot claim your own donation!');
        return;
      }

      // Check available quantity
      const availableQuantity = listing?.remaining_quantity || listing?.quantity || '0';
      const availableQuantityNum = parseFloat(availableQuantity.replace(/[^0-9.]/g, '')) || 0;
      const claimQuantityNum = parseFloat(claimQuantity.replace(/[^0-9.]/g, '')) || 0;

      if (claimQuantityNum > availableQuantityNum) {
        toast.error(`Cannot claim ${claimQuantity}. Only ${availableQuantity} available.`);
        return;
      }

      // Create a new claim document
      const claimData: Omit<Claim, 'id' | 'created_at'> = {
        listing_id: listingId,
        claimer_id: user.uid,
        claimer_name: userProfile.name,
        claimer_contact: userProfile.contact,
        quantity: claimQuantity,
      };

      await addDoc(claimsRef, {
        ...claimData,
        created_at: new Date(),
      });

      // Calculate new remaining quantity from all claims
      const allListingClaimsQuery = query(claimsRef, where('listing_id', '==', listingId));
      const allClaimsSnapshot = await getDocs(allListingClaimsQuery);
      const allListingClaims = allClaimsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Claim[];

      const originalQuantity = listing?.quantity || '0';
      const quantityUnit = originalQuantity.replace(/[0-9.\s]/g, '').trim() || '';
      const originalQuantityNum = parseFloat(originalQuantity.replace(/[^0-9.]/g, '')) || 0;

      let totalClaimedNum = 0;
      allListingClaims.forEach((claim) => {
        const claimNum = parseFloat(claim.quantity.replace(/[^0-9.]/g, '')) || 0;
        totalClaimedNum += claimNum;
      });

      const remainingNum = Math.max(0, originalQuantityNum - totalClaimedNum);
      const remainingQuantity = remainingNum > 0 
        ? `${remainingNum}${quantityUnit ? ' ' + quantityUnit : ''}` 
        : '0';

      // Update listing status and remaining quantity
      const newStatus = remainingNum <= 0 ? 'claimed' : 'active';
      await updateDoc(listingRef, {
        status: newStatus,
        remaining_quantity: remainingQuantity,
      });

      // The real-time subscription will automatically update the map
      if (remainingNum > 0) {
        toast.success(`Successfully claimed ${claimQuantity}! ${remainingQuantity} remaining.`);
      } else {
        toast.success(`Successfully claimed ${claimQuantity}! All items claimed.`);
      }
    } catch (error) {
      console.error('Error claiming listing:', error);
      toast.error('Failed to claim item: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleGetDirections = (listing: Listing) => {
    // Open Google Maps with directions
    const url = `https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                Food Loop
              </h1>
            </Link>
            
            {/* Centered Navigation */}
            <nav className="absolute left-1/2 transform -translate-x-1/2 hidden md:flex items-center gap-8">
              <Link
                href="/donor"
                className="text-base font-semibold text-gray-700 hover:text-green-600 transition-all duration-200 relative group"
              >
                Donate
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-green-600 transition-all duration-200 group-hover:w-full"></span>
              </Link>
              <Link
                href="/claimer"
                className="text-base font-semibold text-green-600 relative"
              >
                Claim
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-green-600"></span>
              </Link>
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {userProfile && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                      <span className="text-white font-semibold text-sm">{userProfile.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                      <p className="text-xs text-gray-500">{userProfile.contact}</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{userProfile.contact}</p>
                        <p className="text-xs text-gray-400 mt-1">{userProfile.email}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await signOut();
                          setProfileDropdownOpen(false);
                          router.push('/login');
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
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

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Available Food</h1>
          <p className="text-gray-600">Browse and claim available food donations in your area</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Available Food List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900">
                  Available Food
                  <span className="ml-2 text-sm font-normal text-gray-500">({listings.length})</span>
                </h2>
              </div>
              <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🍽️</div>
                    <p className="text-gray-500 font-medium">No available listings</p>
                    <p className="text-sm text-gray-400 mt-1">Check back later!</p>
                  </div>
                ) : (
                  listings.map((listing) => {
                    const isOwnDonation = !!(user?.uid && listing.donor_id && listing.donor_id === user.uid);
                    return (
                      <div
                        key={listing.id}
                        onClick={() => setSelectedListingId(listing.id)}
                        className={`group relative bg-white border-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${
                          selectedListingId === listing.id
                            ? 'border-green-500 shadow-lg scale-[1.02]'
                            : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                        }`}
                      >
                        {listing.image_url && (
                          <div className="relative h-40 overflow-hidden bg-gray-100">
                            <img
                              src={listing.image_url}
                              alt={listing.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {isOwnDonation && (
                              <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-semibold text-gray-700 shadow-sm">
                                Your Donation
                              </div>
                            )}
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">{listing.title}</h3>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1 text-green-600">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-semibold">{listing.remaining_quantity || listing.quantity}</span>
                            </div>
                            {listing.remaining_quantity && listing.remaining_quantity !== listing.quantity && (
                              <span className="text-xs text-gray-400 line-through">{listing.quantity}</span>
                            )}
                          </div>

                          {listing.donor_name && (
                            <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="truncate">{listing.donor_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{listing.address}</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isOwnDonation) return;
                                handleClaimClick(listing);
                              }}
                              disabled={isOwnDonation}
                              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                                isOwnDonation
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md active:scale-95'
                              }`}
                              title={isOwnDonation ? 'Cannot claim your own donation' : 'Claim this item'}
                            >
                              {isOwnDonation ? 'Your Donation' : 'Claim Now'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGetDirections(listing);
                              }}
                              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all active:scale-95"
                              title="Get Directions"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Map View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
              <div className="h-full">
                {isMapReady ? (
                  <MapView 
                    key={`${pathname}-${mapKey}`}
                    mapKey={mapKey}
                    listings={listings} 
                    onClaimListing={handleClaimClick}
                    selectedListingId={selectedListingId}
                    onListingSelect={(listing) => {
                      setSelectedListingId(listing?.id || null);
                    }}
                    onGetDirections={handleGetDirections}
                    currentUserId={user?.uid}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading map...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* My Claims Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">
              My Claims
              <span className="ml-2 text-sm font-normal text-gray-500">({myClaims.length})</span>
            </h2>
          </div>
          <div className="p-6">
            {myClaims.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-gray-500 font-medium">No claims yet</p>
                <p className="text-sm text-gray-400 mt-1">Browse available food to claim items!</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {myClaims.map((claim) => (
                  <MyClaimCard
                    key={claim.id}
                    claim={claim}
                    onGetDirections={handleGetDirections}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Claim Modal */}
        <ClaimModal
          listing={selectedListingForClaim}
          isOpen={claimModalOpen}
          onClose={() => {
            setClaimModalOpen(false);
            setSelectedListingForClaim(null);
          }}
          onConfirm={handleClaimListing}
          maxQuantity={selectedListingForClaim?.remaining_quantity || selectedListingForClaim?.quantity || ''}
        />
      </div>
    </div>
  );
}

