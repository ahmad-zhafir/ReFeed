'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getCurrentUser, getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { doc, getDoc, runTransaction, Timestamp, collection } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, MarketplaceOrder, MarketplacePickupWindow, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
          <Link href="/farmer" className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
              ReFeed
            </h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Confirm Purchase</h2>

          {/* Listing Summary */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex gap-4">
              <img src={listing.imageUrl} alt={listing.title} className="w-32 h-32 object-cover rounded-lg" />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{listing.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{listing.category}</p>
                <p className="text-sm text-gray-600 mt-1">{listing.address}</p>
                {listing.weightKg && (
                  <p className="text-sm text-gray-600 mt-1">Weight: ~{listing.weightKg} kg</p>
                )}
                <p className="text-2xl font-bold text-emerald-600 mt-2">
                  {listing.currency} {listing.price.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Payment: Cash on pickup</p>
              </div>
            </div>
          </div>

          {/* Pickup Window Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Pickup Window</h3>
            <div className="space-y-2">
              {listing.pickupWindows.map((window, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedWindow(window)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedWindow === window
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    {new Date(window.start).toLocaleString()} - {new Date(window.end).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {selectedWindow && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-2">Order Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Item:</span>
                  <span className="font-semibold">{listing.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-semibold">{listing.currency} {listing.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pickup:</span>
                  <span className="font-semibold">
                    {new Date(selectedWindow.start).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-bold">Total:</span>
                  <span className="text-emerald-600 font-bold text-lg">
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
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-all font-semibold text-center"
            >
              Cancel
            </Link>
            <button
              onClick={handleConfirmPurchase}
              disabled={!selectedWindow || submitting}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-semibold disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Purchase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

