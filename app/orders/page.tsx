'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange, signOut } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceOrder, MarketplaceRole, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getOrdersCollectionPath } from '@/lib/constants';
import AuthGuard from '@/components/AuthGuard';
import RatingModal from '@/components/RatingModal';
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
  const [activeTab, setActiveTab] = useState<'reserved' | 'completed' | 'cancelled'>('reserved');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [selectedOrderForRating, setSelectedOrderForRating] = useState<MarketplaceOrder | null>(null);
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
      <div className="min-h-screen bg-[#102213] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13ec37] mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  const role = userProfile?.role;
  const homePath = role === 'generator' ? '/generator' : '/farmer';
  const marketplacePath = role === 'generator' ? '/generator' : '/farmer';

  const reservedOrders = orders.filter(o => o.status === 'reserved');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  const getCurrentTabOrders = () => {
    switch (activeTab) {
      case 'reserved':
        return reservedOrders;
      case 'completed':
        return completedOrders;
      case 'cancelled':
        return cancelledOrders;
      default:
        return [];
    }
  };

  const currentTabOrders = getCurrentTabOrders();

  return (
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen flex flex-col">
      {/* Top Navigation - Same as Dashboard */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#112214]/95 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Logo */}
            <Link href={homePath} className="flex items-center gap-3 text-slate-900 dark:text-white cursor-pointer">
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
                <Link href={marketplacePath} className="text-[#92c99b] font-medium text-sm hover:text-white transition-colors">
                  {role === 'generator' ? 'Dashboard' : 'Marketplace'}
                </Link>
                <Link href="/schedule" className="text-[#92c99b] font-medium text-sm hover:text-white transition-colors">
                  Pickups
                </Link>
                <Link href="/orders" className="text-white font-medium text-sm border-b-2 border-[#13ec37] transition-colors">
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
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">My Orders</h2>
          <p className="text-gray-600 dark:text-[#92c99b]">View and manage all your orders</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-[#234829]">
          <button
            onClick={() => setActiveTab('reserved')}
            className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'reserved'
                ? 'text-white dark:text-white border-[#13ec37]'
                : 'text-gray-600 dark:text-[#92c99b] border-transparent hover:text-white dark:hover:text-white'
            }`}
          >
            Reserved ({reservedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'completed'
                ? 'text-white dark:text-white border-[#13ec37]'
                : 'text-gray-600 dark:text-[#92c99b] border-transparent hover:text-white dark:hover:text-white'
            }`}
          >
            Completed ({completedOrders.length})
          </button>
          {cancelledOrders.length > 0 && (
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
                activeTab === 'cancelled'
                  ? 'text-white dark:text-white border-[#13ec37]'
                  : 'text-gray-600 dark:text-[#92c99b] border-transparent hover:text-white dark:hover:text-white'
              }`}
            >
              Cancelled ({cancelledOrders.length})
            </button>
          )}
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1c2e20] rounded-xl border border-gray-200 dark:border-[#234829]">
            <div className="mb-6">
              <span className="material-symbols-outlined text-gray-300 dark:text-[#5d8265] text-6xl mb-4 inline-block">shopping_bag</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No orders yet</h3>
            <p className="text-gray-600 dark:text-[#92c99b] mb-6 max-w-md mx-auto">
              {role === 'generator' 
                ? 'Once farmers reserve your listings, they will appear here.'
                : 'Reserve a listing to see your orders here.'}
            </p>
            <Link
              href={homePath}
              className="inline-block px-6 py-3 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg transition-colors font-bold"
            >
              {role === 'generator' ? 'Post a Listing' : 'Browse Listings'}
            </Link>
          </div>
        ) : currentTabOrders.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#1c2e20] rounded-xl border border-gray-200 dark:border-[#234829]">
            <span className="material-symbols-outlined text-gray-300 dark:text-[#5d8265] text-5xl mb-4 inline-block">
              {activeTab === 'reserved' ? 'schedule' : activeTab === 'completed' ? 'check_circle' : 'cancel'}
            </span>
            <p className="text-gray-600 dark:text-[#92c99b]">
              No {activeTab} orders yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentTabOrders.map((order) => {
              const getStatusBadge = () => {
                switch (order.status) {
                  case 'reserved':
                    return (
                      <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-semibold border border-yellow-500/20">
                        Reserved
                      </span>
                    );
                  case 'completed':
                    return (
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-semibold border border-blue-500/20">
                        Completed
                      </span>
                    );
                  case 'cancelled':
                    return (
                      <span className="px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-xs font-semibold border border-red-500/20">
                        Cancelled
                      </span>
                    );
                  default:
                    return (
                      <span className="px-3 py-1 bg-gray-500/10 text-gray-400 rounded-full text-xs font-semibold border border-gray-500/20">
                        {order.status}
                      </span>
                    );
                }
              };

              return (
                <div 
                  key={order.id} 
                  className={`bg-white dark:bg-[#1c2e20] rounded-xl shadow-md p-6 border border-gray-200 dark:border-[#234829] ${
                    order.status === 'completed' || order.status === 'cancelled' ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    <img src={order.imageUrl} alt={order.title} className="w-24 h-24 object-cover rounded-lg" />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{order.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-[#92c99b]">{order.category}</p>
                        </div>
                        {getStatusBadge()}
                      </div>
                      <p className="text-gray-600 dark:text-[#92c99b] text-sm mb-2">{order.address}</p>
                      <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                          {order.scheduledWindow && (
                            <p className="text-sm text-gray-600 dark:text-[#92c99b]">
                              Pickup: {new Date(order.scheduledWindow.start).toLocaleString()}
                            </p>
                          )}
                          <p className="text-lg font-bold text-emerald-600 dark:text-[#13ec37] mt-1">
                            {order.currency} {order.price.toFixed(2)}
                          </p>
                        </div>
                        {role === 'generator' && order.status === 'reserved' && (
                          <button
                            onClick={() => markCompleted(order.id)}
                            className="px-4 py-2 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg font-semibold transition-colors flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Mark Completed
                          </button>
                        )}
                      </div>
                      {order.status === 'completed' && (
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-xs text-gray-500 dark:text-[#92c99b]">
                            Completed on {order.createdAt?.toDate?.().toLocaleDateString()}
                          </p>
                          {role === 'farmer' && !order.ratingId && (
                            <button
                              onClick={() => {
                                setSelectedOrderForRating(order);
                                setRatingModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-[#13ec37] hover:bg-[#11d832] text-[#102213] rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-sm">star</span>
                              Rate Order
                            </button>
                          )}
                          {order.ratingId && (
                            <span className="px-3 py-1.5 bg-yellow-500/10 text-yellow-500 rounded-lg text-sm font-medium flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-sm fill-yellow-500">star</span>
                              Rated
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Rating Modal */}
      {selectedOrderForRating && (
        <RatingModal
          isOpen={ratingModalOpen}
          onClose={() => {
            setRatingModalOpen(false);
            setSelectedOrderForRating(null);
          }}
          orderId={selectedOrderForRating.id}
          listingTitle={selectedOrderForRating.title}
          generatorName={selectedOrderForRating.generatorUid} // You might want to fetch generator name
          farmerUid={user?.uid || ''}
          onRatingSubmitted={() => {
            // Reload orders to show updated rating
            if (userProfile?.role) {
              loadOrders(user.uid, userProfile.role);
            }
          }}
        />
      )}
    </div>
  );
}

