'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        const profile = await getUserProfile(user.uid);
        setUserProfile(profile);
        await loadListing(user.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router, listingId]);

  const loadListing = async (generatorUid: string) => {
    try {
      const db = getFirestoreDb();
      const listingDoc = await getDoc(doc(db, getListingsCollectionPath(), listingId));
      
      if (!listingDoc.exists()) {
        toast.error('Listing not found');
        router.push('/generator');
        return;
      }

      const listingData = { id: listingDoc.id, ...listingDoc.data() } as MarketplaceListing;
      
      if (listingData.generatorUid !== generatorUid) {
        toast.error('Unauthorized');
        router.push('/generator');
        return;
      }

      setListing(listingData);

      // Load order info if reserved
      if (listingData.status === 'reserved' && listingData.reservedBy) {
        const ordersRef = collection(db, getOrdersCollectionPath());
        const q = query(ordersRef, where('listingId', '==', listingId));
        const ordersSnapshot = await getDocs(q);
        if (!ordersSnapshot.empty) {
          setOrderInfo(ordersSnapshot.docs[0].data());
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading listing:', error);
      toast.error('Failed to load listing');
      router.push('/generator');
    }
  };

  const markCompleted = async () => {
    if (!listing) return;
    
    try {
      const db = getFirestoreDb();
      await updateDoc(doc(db, getListingsCollectionPath(), listingId), {
        status: 'completed',
      });
      
      // Also update order status
      if (orderInfo) {
        const ordersRef = collection(db, getOrdersCollectionPath());
        const q = query(ordersRef, where('listingId', '==', listingId));
        const ordersSnapshot = await getDocs(q);
        if (!ordersSnapshot.empty) {
          await updateDoc(ordersSnapshot.docs[0].ref, {
            status: 'completed',
          });
        }
      }
      
      toast.success('Listing marked as completed');
      router.push('/generator');
    } catch (error) {
      console.error('Error updating listing:', error);
      toast.error('Failed to update listing');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[#13ec37]/10 text-[#13ec37] border border-[#13ec37]/20">
            <span className="size-2 rounded-full bg-[#13ec37]"></span>
            Live
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
            <span className="size-2 rounded-full bg-yellow-500"></span>
            Reserved
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="size-2 rounded-full bg-blue-400"></span>
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <span className="size-2 rounded-full bg-gray-400"></span>
            {status}
          </span>
        );
    }
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('fruit') || categoryLower.includes('rind')) return 'nutrition';
    if (categoryLower.includes('leafy') || categoryLower.includes('greens')) return 'local_florist';
    if (categoryLower.includes('vegetative') || categoryLower.includes('vegetable')) return 'eco';
    if (categoryLower.includes('bakery') || categoryLower.includes('grain')) return 'bakery_dining';
    if (categoryLower.includes('dairy')) return 'lunch_dining';
    if (categoryLower.includes('meat')) return 'set_meal';
    if (categoryLower.includes('prepared') || categoryLower.includes('cooked')) return 'restaurant';
    if (categoryLower.includes('beverage')) return 'local_drink';
    return 'recycling';
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
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#102213]/80 backdrop-blur-md">
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href="/generator" className="flex items-center gap-4 text-slate-900 dark:text-white cursor-pointer">
            <div className="size-8 text-[#13ec37]">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">ReFeed</h2>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col gap-6">
          {/* Back Button */}
          <Link
            href="/generator"
            className="flex items-center gap-2 text-[#92c99b] text-sm font-medium hover:text-white transition-colors w-fit"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Dashboard
          </Link>

          {/* Main Card */}
          <div className="bg-white dark:bg-[#1c2e20] border border-gray-200 dark:border-[#234829] rounded-xl shadow-lg overflow-hidden">
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
                  {/* Image Navigation */}
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
                      {/* Image Indicators */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {listing.imageUrls.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedImageIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              selectedImageIndex === index
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
              <div className="flex gap-2 p-4 bg-gray-50 dark:bg-[#112214] overflow-x-auto">
                {[listing.imageUrl, ...listing.imageUrls].map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(Math.max(0, index - 1))}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      (index === 0 && selectedImageIndex === 0) || (index > 0 && selectedImageIndex === index - 1)
                        ? 'border-[#13ec37]'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-[#234829]'
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
            
            {/* Content */}
            <div className="p-6 md:p-8">
              {/* Header Section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-[#234829]">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-[#234829] rounded-lg p-2">
                      <span className="material-symbols-outlined text-[#13ec37] text-2xl">{getCategoryIcon(listing.category)}</span>
                    </div>
                    <div>
                      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">{listing.title}</h1>
                      {getStatusBadge(listing.status)}
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-[#92c99b] text-base">{listing.category}</p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-sm text-slate-500 dark:text-[#92c99b] mb-1">Price</p>
                  <p className="text-4xl font-bold text-[#13ec37]">
                    {listing.currency} {listing.price.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {listing.weightKg && (
                  <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-[#234829] rounded-lg">
                    <div className="bg-[#13ec37]/10 rounded-lg p-2">
                      <span className="material-symbols-outlined text-[#13ec37] text-xl">scale</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-500 dark:text-[#92c99b] mb-1">Weight</h3>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">~{listing.weightKg} kg</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-[#234829] rounded-lg">
                  <div className="bg-[#13ec37]/10 rounded-lg p-2">
                    <span className="material-symbols-outlined text-[#13ec37] text-xl">location_on</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-[#92c99b] mb-1">Pickup Location</h3>
                    <p className="text-base font-medium text-slate-900 dark:text-white">{listing.address}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {listing.notes && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-[#234829] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[#13ec37] text-lg">note</span>
                    <h3 className="text-base font-medium text-slate-900 dark:text-white">Notes</h3>
                  </div>
                  <p className="text-slate-700 dark:text-[#92c99b] leading-relaxed">{listing.notes}</p>
                </div>
              )}

              {/* Reserved Order Info */}
              {listing.status === 'reserved' && orderInfo && (
                <div className="mb-6 p-5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-yellow-500/20 rounded-lg p-2">
                      <span className="material-symbols-outlined text-yellow-500 text-xl">pending</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reserved Order</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-yellow-500 text-base">schedule</span>
                      <div>
                        <p className="text-slate-600 dark:text-[#92c99b] mb-1">Scheduled Pickup</p>
                        <p className="text-slate-900 dark:text-white font-medium">
                          {new Date(orderInfo.scheduledWindow.start).toLocaleString('en-US', { 
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })} - {new Date(orderInfo.scheduledWindow.end).toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-yellow-500 text-base">payments</span>
                      <div>
                        <p className="text-slate-600 dark:text-[#92c99b] mb-1">Payment</p>
                        <p className="text-slate-900 dark:text-white font-medium">
                          {orderInfo.currency} {orderInfo.price.toFixed(2)} (Cash on pickup)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pickup Windows */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#13ec37] text-lg">event</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Available Pickup Windows</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {listing.pickupWindows.map((window, index) => {
                    const startDate = new Date(window.start);
                    const endDate = new Date(window.end);
                    const isPast = endDate < new Date();
                    const isToday = startDate.toDateString() === new Date().toDateString();
                    const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                    
                    return (
                      <div 
                        key={index} 
                        className={`p-4 rounded-lg border transition-colors ${
                          isPast 
                            ? 'bg-gray-50 dark:bg-[#112214] border-gray-200 dark:border-[#234829] opacity-60' 
                            : listing.status === 'reserved' && index === 0
                            ? 'bg-yellow-500/10 border-yellow-500/20'
                            : 'bg-gray-50 dark:bg-[#234829] border-gray-200 dark:border-[#234829]'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#13ec37] text-base">
                              {isPast ? 'history' : 'schedule'}
                            </span>
                            {isPast && <span className="text-xs text-slate-500 dark:text-gray-500 font-medium">Past</span>}
                            {!isPast && listing.status === 'reserved' && index === 0 && (
                              <span className="text-xs text-yellow-500 font-medium">Reserved</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : startDate.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: startDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                          })}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-[#92c99b]">
                          {startDate.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })} - {endDate.toLocaleTimeString('en-US', { 
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              {listing.status === 'reserved' && (
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-[#234829]">
                  <button
                    onClick={markCompleted}
                    className="flex-1 h-12 rounded-lg bg-[#13ec37] hover:bg-[#11d632] text-[#112214] font-bold transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(19,236,55,0.3)]"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Mark as Completed
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

