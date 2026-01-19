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

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <Link href="/generator" className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
              ReFeed
            </h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <img src={listing.imageUrl} alt={listing.title} className="w-full h-64 md:h-96 object-cover" />
          
          <div className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{listing.title}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  listing.status === 'live' ? 'bg-green-100 text-green-700' :
                  listing.status === 'reserved' ? 'bg-orange-100 text-orange-700' :
                  listing.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {listing.status}
                </span>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">
                  {listing.currency} {listing.price.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Category</h3>
                <p className="text-gray-900">{listing.category}</p>
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
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
                <p className="text-gray-900">{listing.address}</p>
              </div>
            </div>

            {listing.notes && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-gray-900">{listing.notes}</p>
              </div>
            )}

            {listing.status === 'reserved' && orderInfo && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Reserved Order</h3>
                <p className="text-sm text-gray-700">
                  Scheduled pickup: {new Date(orderInfo.scheduledWindow.start).toLocaleString()} - {new Date(orderInfo.scheduledWindow.end).toLocaleString()}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  Payment: {orderInfo.currency} {orderInfo.price.toFixed(2)} (Cash on pickup)
                </p>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Pickup Windows</h3>
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
                href="/generator"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-all font-semibold text-center"
              >
                Back
              </Link>
              {listing.status === 'reserved' && (
                <button
                  onClick={markCompleted}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold"
                >
                  Mark Completed
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

