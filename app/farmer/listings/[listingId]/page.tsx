'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Logo from '@/components/Logo';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  if (listing.status !== 'live') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Listing Not Available</h2>
          <p className="text-gray-600 mb-6">This listing is no longer available for purchase.</p>
          <Link href="/farmer" className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <Link href="/farmer" className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
              ReFeed
            </h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          {/* Image Gallery */}
          <div className="relative w-full h-64 md:h-96 bg-gray-100">
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
            <div className="flex gap-2 p-4 bg-gray-50 overflow-x-auto border-b border-gray-100">
              {[listing.imageUrl, ...listing.imageUrls].map((url, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(Math.max(0, index - 1))}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    (index === 0 && selectedImageIndex === 0) || (index > 0 && selectedImageIndex === index - 1)
                      ? 'border-emerald-600'
                      : 'border-transparent hover:border-gray-300'
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{listing.title}</h1>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  {listing.category}
                </span>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">
                  {listing.currency} {listing.price.toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Cash on pickup</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
                <p className="text-gray-900">{listing.address}</p>
                {distance !== null && (
                  <p className="text-sm text-gray-600 mt-1">{distance.toFixed(1)} km away</p>
                )}
              </div>
              {listing.weightKg && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Weight</h3>
                  <p className="text-gray-900">~{listing.weightKg} kg</p>
                </div>
              )}
              {listing.expiryAt && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Expiry</h3>
                  <p className="text-gray-900">{new Date(listing.expiryAt).toLocaleDateString()}</p>
                </div>
              )}
              {listing.generatorName && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Generator</h3>
                  <p className="text-gray-900">{listing.generatorName}</p>
                </div>
              )}
            </div>

            {listing.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-gray-900">{listing.notes}</p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Available Pickup Windows</h3>
              <div className="space-y-2">
                {listing.pickupWindows.map((window, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-900">
                      {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Link
                href="/farmer"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-all font-semibold text-center"
              >
                Back
              </Link>
              <Link
                href={`/farmer/checkout/${listingId}`}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-semibold text-center"
              >
                Buy Now (FCFS)
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

