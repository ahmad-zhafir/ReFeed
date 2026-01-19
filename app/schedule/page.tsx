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

export default function SchedulePage() {
  return (
    <AuthGuard>
      <ScheduleContent />
    </AuthGuard>
  );
}

function ScheduleContent() {
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
      
      const q = role === 'generator'
        ? query(ordersRef, where('generatorUid', '==', userId), where('status', '==', 'reserved'))
        : query(ordersRef, where('farmerUid', '==', userId), where('status', '==', 'reserved'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MarketplaceOrder[];
        
        // Sort by pickup time
        ordersData.sort((a, b) => {
          const aTime = new Date(a.scheduledWindow.start).getTime();
          const bTime = new Date(b.scheduledWindow.start).getTime();
          return aTime - bTime;
        });
        
        setOrders(ordersData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading schedule:', error);
    }
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

  // Group orders by date
  const groupedOrders = orders.reduce((acc, order) => {
    const date = new Date(order.scheduledWindow.start).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(order);
    return acc;
  }, {} as Record<string, MarketplaceOrder[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <Link href={homePath} className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
              ReFeed
            </h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-600 mb-4">No scheduled pickups yet.</p>
            <Link
              href={homePath}
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {role === 'generator' ? 'Post a Listing' : 'Browse Listings'}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([date, dateOrders]) => (
              <div key={date} className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{date}</h2>
                <div className="space-y-4">
                  {dateOrders.map((order) => (
                    <div key={order.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <img src={order.imageUrl} alt={order.title} className="w-20 h-20 object-cover rounded-lg" />
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{order.title}</h3>
                        <p className="text-sm text-gray-600">{order.address}</p>
                        <p className="text-sm font-semibold text-emerald-600 mt-1">
                          {order.currency} {order.price.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(order.scheduledWindow.start).toLocaleTimeString()} - {new Date(order.scheduledWindow.end).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

