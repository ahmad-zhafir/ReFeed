'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceOrder, MarketplaceRole, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getOrdersCollectionPath } from '@/lib/constants';
import AuthGuard from '@/components/AuthGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersContent />
    </AuthGuard>
  );
}

function OrdersContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        
        if (profile?.role) {
          await loadOrders(currentUser.uid, profile.role);
        }
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadOrders = async (userId: string, role: MarketplaceRole) => {
    try {
      const db = getFirestoreDb();
      const ordersRef = collection(db, getOrdersCollectionPath());
      
      // Query orders based on role
      const q = role === 'generator'
        ? query(ordersRef, where('generatorUid', '==', userId))
        : query(ordersRef, where('farmerUid', '==', userId));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MarketplaceOrder[];
        
        // Sort by creation date (newest first)
        ordersData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        
        setOrders(ordersData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    }
  };

  const markCompleted = async (orderId: string) => {
    // This would update the order status - implementation depends on your needs
    toast.success('Order marked as completed');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const role = userProfile?.role;
  const homePath = role === 'generator' ? '/generator' : '/farmer';

  const reservedOrders = orders.filter(o => o.status === 'reserved');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href={homePath} className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                ReFeed
              </h1>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button className="px-4 py-2 font-semibold text-gray-900 border-b-2 border-green-600">
            Reserved ({reservedOrders.length})
          </button>
          <button className="px-4 py-2 font-semibold text-gray-600">
            Completed ({completedOrders.length})
          </button>
          {cancelledOrders.length > 0 && (
            <button className="px-4 py-2 font-semibold text-gray-600">
              Cancelled ({cancelledOrders.length})
            </button>
          )}
        </div>

        {/* Orders List */}
        {reservedOrders.length === 0 && completedOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-600 mb-4">No orders yet.</p>
            <Link
              href={homePath}
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Browse Listings
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reservedOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <div className="flex gap-4">
                  <img src={order.imageUrl} alt={order.title} className="w-24 h-24 object-cover rounded-lg" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{order.title}</h3>
                        <p className="text-sm text-gray-600">{order.category}</p>
                      </div>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{order.address}</p>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">
                          Pickup: {new Date(order.scheduledWindow.start).toLocaleString()}
                        </p>
                        <p className="text-lg font-bold text-emerald-600 mt-1">
                          {order.currency} {order.price.toFixed(2)}
                        </p>
                      </div>
                      {role === 'generator' && (
                        <button
                          onClick={() => markCompleted(order.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {completedOrders.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Completed Orders</h2>
                <div className="space-y-4">
                  {completedOrders.map((order) => (
                    <div key={order.id} className="bg-white rounded-xl shadow-md p-6 border border-gray-200 opacity-75">
                      <div className="flex gap-4">
                        <img src={order.imageUrl} alt={order.title} className="w-24 h-24 object-cover rounded-lg" />
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900">{order.title}</h3>
                          <p className="text-sm text-gray-600">{order.category}</p>
                          <p className="text-lg font-bold text-emerald-600 mt-2">
                            {order.currency} {order.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Completed on {order.createdAt?.toDate?.().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

