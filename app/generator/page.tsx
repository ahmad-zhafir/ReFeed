'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, signOut, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplaceOrder } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import FarmerMapView from '@/components/FarmerMapView';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function GeneratorDashboard() {
  return (
    <RoleGuard allowedRoles={['generator']}>
      <GeneratorDashboardContent />
    </RoleGuard>
  );
}

function GeneratorDashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'analytics' | 'map'>('dashboard');
  const [farmers, setFarmers] = useState<UserProfile[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'reserved' | 'completed' | 'cancelled'>('reserved');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);

        if (profile) {
          await loadListings(currentUser.uid);
          await loadOrders(currentUser.uid);
          await loadFarmers();
        }
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadListings = async (generatorUid: string) => {
    try {
      const db = getFirestoreDb();
      const listingsRef = collection(db, getListingsCollectionPath());
      const q = query(listingsRef, where('generatorUid', '==', generatorUid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const listingsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MarketplaceListing[];
        setListings(listingsData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading listings:', error);
      toast.error('Failed to load listings');
    }
  };

  const loadFarmers = async () => {
    try {
      const db = getFirestoreDb();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'farmer'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const farmersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as UserProfile[];
        // Filter farmers with valid location data
        const farmersWithLocation = farmersData.filter(
          f => f.location && f.location.latitude && f.location.longitude
        );
        setFarmers(farmersWithLocation);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading farmers:', error);
    }
  };

  const loadOrders = async (generatorUid: string) => {
    try {
      const db = getFirestoreDb();
      const ordersRef = collection(db, getOrdersCollectionPath());
      const q = query(ordersRef, where('generatorUid', '==', generatorUid));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as MarketplaceOrder[];
        setOrders(ordersData);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    }
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      return;
    }

    try {
      const db = getFirestoreDb();
      await deleteDoc(doc(db, getListingsCollectionPath(), listingId));
      toast.success('Listing deleted successfully');
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast.error('Failed to delete listing');
    }
  };

  const markCompleted = async (orderId: string) => {
    try {
      const db = getFirestoreDb();
      const orderRef = doc(db, getOrdersCollectionPath(), orderId);
      await updateDoc(orderRef, {
        status: 'completed',
      });

      // Also update the listing status
      const order = orders.find(o => o.id === orderId);
      if (order) {
        const listingRef = doc(db, getListingsCollectionPath(), order.listingId);
        await updateDoc(listingRef, {
          status: 'completed',
        });
      }

      toast.success('Order marked as completed');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

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

  const calculateImpact = () => {
    const completed = listings.filter(l => l.status === 'completed').length;
    const totalWeight = listings
      .filter(l => l.status === 'completed')
      .reduce((sum, l) => sum + (l.weightKg || 0), 0);

    // Rough estimate: 1kg food waste ≈ 2.5kg CO2 equivalent
    // Convert to tons: divide by 1000
    const carbonReducedTons = (totalWeight * 2.5) / 1000;

    return {
      listingsCompleted: completed,
      wasteDivertedKg: totalWeight,
      carbonReducedTons: carbonReducedTons
    };
  };

  const impact = calculateImpact();

  // Calculate impact score (0-100) based on waste diverted
  const impactScore = Math.min(98, Math.floor(impact.wasteDivertedKg / 100) * 5);
  const impactPercentage = Math.min(98, impactScore);

  // Calculate quick stats
  const activeListings = listings.filter(l => l.status === 'live').length;
  const pendingOrders = orders.filter(o => o.status === 'reserved').length;
  const totalListings = listings.length;
  const totalEarnings = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.price, 0);
  const currency = orders.find(o => o.currency)?.currency || 'MYR';

  // Filter orders by status
  const reservedOrders = orders.filter(o => o.status === 'reserved');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const cancelledOrders = orders.filter(o => o.status === 'cancelled');

  // Calculate ESG Analytics metrics
  const totalCo2Saved = impact.carbonReducedTons;
  const wasteDiversionRate = totalListings > 0 
    ? Math.min(100, (completedOrders.length / totalListings) * 100).toFixed(1)
    : '0.0';
  const goalDiversionRate = 85;
  const costSavings = totalEarnings; // This represents revenue, can be adjusted to actual savings calculation

  // Calculate monthly progress data (last 3 months)
  const getMonthlyData = () => {
    const now = new Date();
    const months: { month: string; actual: number; target: number }[] = [];
    
    for (let i = 2; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      
      // Count completed orders in this month
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthOrders = orders.filter(o => {
        if (o.status !== 'completed') return false;
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });
      
      const actual = monthOrders.length * 10; // Simplified metric
      const target = 15 + (2 - i) * 5; // Increasing target
      
      months.push({
        month: `${monthName} ${day}`,
        actual,
        target
      });
    }
    
    return months;
  };

  const monthlyData = getMonthlyData();

  // Calculate impact breakdown by category
  const getImpactBreakdown = () => {
    const categoryData: { [key: string]: { count: number; weight: number } } = {};
    
    completedOrders.forEach(order => {
      const cat = order.category || 'Other';
      if (!categoryData[cat]) {
        categoryData[cat] = { count: 0, weight: 0 };
      }
      categoryData[cat].count++;
      // Estimate weight from order price (rough estimate)
      categoryData[cat].weight += order.price * 0.5; // Rough conversion
    });
    
    const total = Object.values(categoryData).reduce((sum, data) => sum + data.weight, 0);
    
    return Object.entries(categoryData)
      .map(([category, data]) => ({
        category,
        percentage: total > 0 ? Math.round((data.weight / total) * 100) : 0,
        weight: Math.round(data.weight),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  };

  const impactBreakdown = getImpactBreakdown();
  const totalBreakdownWeight = impactBreakdown.reduce((sum, item) => sum + item.weight, 0);

  // Get upcoming pickups (next 5 reserved orders)
  const upcomingPickups = orders
    .filter(o => o.status === 'reserved')
    .filter(o => {
      const pickupStart = new Date(o.scheduledWindow.start);
      return pickupStart >= new Date();
    })
    .sort((a, b) => {
      const timeA = new Date(a.scheduledWindow.start).getTime();
      const timeB = new Date(b.scheduledWindow.start).getTime();
      return timeA - timeB;
    })
    .slice(0, 5);

  // Filter listings based on search query
  const filteredListings = listings.filter((listing) => {
    if (!searchQuery) return true;
    const queryLower = searchQuery.toLowerCase();
    return (
      listing.title.toLowerCase().includes(queryLower) ||
      listing.category.toLowerCase().includes(queryLower) ||
      listing.address.toLowerCase().includes(queryLower)
    );
  });

  // Get recent listings (latest 3) - filtered
  const recentListings = [...filteredListings]
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    })
    .slice(0, 3);

  // Get sorted listings for inventory view
  const sortedListings = [...filteredListings].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

  // Get filtered orders based on status filter
  const filteredOrders = orderStatusFilter === 'reserved'
    ? reservedOrders
    : orderStatusFilter === 'completed'
      ? completedOrders
      : cancelledOrders;

  // Sort filtered orders by creation date
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#13ec37]/10 text-[#13ec37] border border-[#13ec37]/20">
            <span className="size-1.5 rounded-full bg-[#13ec37]"></span> Live
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
            <span className="size-1.5 rounded-full bg-yellow-500"></span> Claimed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="size-1.5 rounded-full bg-blue-400"></span> Collected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
            <span className="size-1.5 rounded-full bg-gray-500"></span> {status}
          </span>
        );
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('coffee') || categoryLower.includes('ground')) return 'coffee';
    if (categoryLower.includes('citrus') || categoryLower.includes('peel')) return 'nutrition';
    if (categoryLower.includes('egg')) return 'egg';
    if (categoryLower.includes('vegetable') || categoryLower.includes('vegetative')) return 'eco';
    return 'recycling';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
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
  return (
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased overflow-hidden flex flex-col h-screen">
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

          <div className="flex items-center gap-4 ml-auto">
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
                      <p className="text-sm font-semibold text-white">{userProfile?.name}</p>
                      <p className="text-xs text-[#92c99b] mt-1">{userProfile?.contact}</p>
                    </div>
                    <Link href="/settings" className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors">
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('orders');
                      }}
                      className="block w-full text-left px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
                    >
                      Orders
                    </button>
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
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-slate-900 dark:text-white"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`w-64 flex-shrink-0 border-r border-[#234829] bg-[#112214] flex flex-col justify-between p-4 transition-transform duration-300 ${sidebarOpen ? 'fixed lg:relative inset-y-0 left-0 z-50' : 'hidden lg:flex'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="flex flex-col gap-6">
            <div className="flex gap-3 items-center px-3 py-4 bg-[#1c2e20]/50 rounded-xl border border-[#234829]">
              <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-[#234829] shrink-0 bg-gradient-to-br from-[#13ec37] to-green-400 flex items-center justify-center">
                <span className="text-[#102213] font-bold text-sm">{userProfile?.name?.charAt(0).toUpperCase() || 'R'}</span>
              </div>
              <div className="flex flex-col overflow-hidden">
                <h1 className="text-white text-sm font-bold leading-tight truncate">{userProfile?.name || 'Restaurant'}</h1>
                <p className="text-[#92c99b] text-[10px] font-normal uppercase tracking-wide">Restaurant Admin</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1.5">
              <p className="px-3 text-xs font-semibold text-[#5d8265] uppercase tracking-wider mb-2">Menu</p>

              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'dashboard'
                  ? 'bg-[#13ec37]/20 text-white border border-[#13ec37]/10'
                  : 'hover:bg-[#234829] text-[#92c99b] hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined transition-transform ${activeTab === 'dashboard' ? 'text-[#13ec37] group-hover:scale-110' : 'group-hover:text-[#13ec37]'}`}>dashboard</span>
                <p className="text-sm font-medium">Dashboard</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('inventory');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'inventory'
                  ? 'bg-[#13ec37]/20 text-white border border-[#13ec37]/10'
                  : 'hover:bg-[#234829] text-[#92c99b] hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'inventory' ? 'text-[#13ec37]' : 'group-hover:text-[#13ec37]'}`}>recycling</span>
                <p className="text-sm font-medium">Waste Inventory</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('orders');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'orders'
                  ? 'bg-[#13ec37]/20 text-white border border-[#13ec37]/10'
                  : 'hover:bg-[#234829] text-[#92c99b] hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'orders' ? 'text-[#13ec37]' : 'group-hover:text-[#13ec37]'}`}>receipt_long</span>
                <p className="text-sm font-medium">Orders</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('analytics');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'analytics'
                  ? 'bg-[#13ec37]/20 text-white border border-[#13ec37]/10'
                  : 'hover:bg-[#234829] text-[#92c99b] hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'analytics' ? 'text-[#13ec37]' : 'group-hover:text-[#13ec37]'}`}>query_stats</span>
                <p className="text-sm font-medium">ESG Analytics</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('map');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'map'
                  ? 'bg-[#13ec37]/20 text-white border border-[#13ec37]/10'
                  : 'hover:bg-[#234829] text-[#92c99b] hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'map' ? 'text-[#13ec37]' : 'group-hover:text-[#13ec37]'}`}>map</span>
                <p className="text-sm font-medium">Find Farmers</p>
              </button>
            </nav>
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-[#1c2e20] p-4 rounded-lg border border-[#234829] relative overflow-hidden">
              <div className="absolute -right-2 -top-2 text-[#234829] opacity-50">
                <span className="material-symbols-outlined text-[48px]">eco</span>
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#92c99b]">Impact Score</span>
                  <span className="text-[#13ec37] font-bold text-xs">{impactPercentage}/100</span>
                </div>
                <div className="w-full bg-[#234829] rounded-full h-1.5 mb-2">
                  <div className="bg-[#13ec37] h-1.5 rounded-full" style={{ width: `${impactPercentage}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-400">Top 5% in your city</p>
              </div>
            </div>

            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#234829] text-[#92c99b] hover:text-white transition-colors group">
              <span className="material-symbols-outlined group-hover:text-[#13ec37] transition-colors">settings</span>
              <p className="text-sm font-medium">Settings</p>
            </Link>

            <button
              onClick={async () => {
                try {
                  await signOut();
                  await new Promise(resolve => setTimeout(resolve, 100));
                  router.push('/');
                } catch (error: any) {
                  console.error('Logout error:', error);
                  toast.error('Failed to sign out. Please try again.');
                }
              }}
              className="flex items-center gap-3 px-3 py-2 text-[#92c99b] hover:text-white transition-colors hover:bg-[#234829] rounded-lg"
            >
              <span className="material-symbols-outlined">logout</span>
              <p className="text-sm font-medium">Log Out</p>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#102213] relative">
          {/* Search Bar */}
          <div className="flex-none h-16 border-b border-[#234829] px-6 py-3 flex items-center justify-between bg-[#102213]/90 backdrop-blur-sm sticky top-0 z-10">
            <div className="w-full max-w-lg">
              <div className="relative w-full text-[#92c99b] focus-within:text-[#13ec37] group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="material-symbols-outlined group-focus-within:text-[#13ec37] transition-colors">search</span>
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full py-2 pl-10 pr-4 text-sm text-white bg-[#1c2e20] border border-[#234829] rounded-lg focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] placeholder-[#92c99b]/50 transition-all hover:bg-[#234829]"
                  placeholder={activeTab === 'dashboard' ? 'Search listings...' : 'Search listings...'}
                  type="text"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
            {activeTab === 'dashboard' ? (
              <>
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-white text-3xl font-black tracking-tight">
                      {getGreeting()}, {userProfile?.name || 'User'}
                    </h2>
                    <p className="text-[#92c99b] text-base font-normal">Here is your impact summary for this week.</p>
                  </div>
                  <Link
                    href="/generator/listings/new"
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg shadow-[0_0_20px_rgba(19,236,55,0.3)] transition-all transform hover:scale-105 group"
                  >
                    <span className="material-symbols-outlined font-bold group-hover:rotate-90 transition-transform">add</span>
                    <span className="text-sm font-bold tracking-wide">List Waste</span>
                  </Link>
                </div>

                {/* Quick Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Active Listings */}
                  <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#92c99b] text-sm font-medium mb-1">Active Listings</p>
                        <h3 className="text-3xl font-bold text-white">{activeListings}</h3>
                      </div>
                      <div className="bg-[#13ec37]/10 rounded-full p-3">
                        <span className="material-symbols-outlined text-[#13ec37] text-2xl">recycling</span>
                      </div>
                    </div>
                  </div>

                  {/* Pending Orders */}
                  <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#92c99b] text-sm font-medium mb-1">Pending Orders</p>
                        <h3 className="text-3xl font-bold text-white">{pendingOrders}</h3>
                      </div>
                      <div className="bg-yellow-500/10 rounded-full p-3">
                        <span className="material-symbols-outlined text-yellow-500 text-2xl">pending</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Listings */}
                  <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#92c99b] text-sm font-medium mb-1">Total Listings</p>
                        <h3 className="text-3xl font-bold text-white">{totalListings}</h3>
                      </div>
                      <div className="bg-blue-500/10 rounded-full p-3">
                        <span className="material-symbols-outlined text-blue-400 text-2xl">inventory_2</span>
                      </div>
                    </div>
                  </div>

                  {/* Total Earnings */}
                  <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[#92c99b] text-sm font-medium mb-1">Total Earnings</p>
                        <h3 className="text-2xl font-bold text-white">
                          {currency} {totalEarnings.toFixed(2)}
                        </h3>
                      </div>
                      <div className="bg-emerald-500/10 rounded-full p-3">
                        <span className="material-symbols-outlined text-emerald-400 text-2xl">payments</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Impact Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Waste Diverted */}
                  <div className="col-span-1 md:col-span-2 bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-[120px] text-[#13ec37]">recycling</span>
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[#92c99b] font-medium mb-1">Total Waste Diverted</p>
                          <h3 className="text-4xl font-bold text-white tracking-tight">
                            {impact.wasteDivertedKg.toFixed(0)} <span className="text-2xl text-[#92c99b] font-normal">kg</span>
                          </h3>
                        </div>
                        {impact.wasteDivertedKg > 0 && (
                          <span className="inline-flex items-center gap-1 bg-[#234829] text-[#13ec37] px-2 py-1 rounded text-sm font-bold">
                            <span className="material-symbols-outlined text-base">trending_up</span> +12%
                          </span>
                        )}
                      </div>
                      <div className="w-full h-64 mt-4">
                        <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
                          <defs>
                            <linearGradient id="gradientGreen" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#13ec37" stopOpacity="0.2"></stop>
                              <stop offset="100%" stopColor="#13ec37" stopOpacity="0"></stop>
                            </linearGradient>
                          </defs>
                          <path d="M0 35 Q 10 30, 20 32 T 40 25 T 60 15 T 80 20 T 100 5 V 40 H 0 Z" fill="url(#gradientGreen)"></path>
                          <path d="M0 35 Q 10 30, 20 32 T 40 25 T 60 15 T 80 20 T 100 5" fill="none" stroke="#13ec37" strokeLinecap="round" strokeWidth="2"></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Carbon Reduction */}
                  <div className="col-span-1 md:col-span-2 bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="material-symbols-outlined text-[120px] text-blue-400">cloud_off</span>
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[#92c99b] font-medium mb-1">Carbon Reduction</p>
                          <h3 className="text-4xl font-bold text-white tracking-tight">
                            {impact.carbonReducedTons.toFixed(1)} <span className="text-2xl text-[#92c99b] font-normal">Tons CO2e</span>
                          </h3>
                        </div>
                        {impact.carbonReducedTons > 0 && (
                          <span className="inline-flex items-center gap-1 bg-[#234829] text-[#13ec37] px-2 py-1 rounded text-sm font-bold">
                            <span className="material-symbols-outlined text-base">trending_up</span> +5%
                          </span>
                        )}
                      </div>
                      <div className="flex items-end justify-between gap-2 h-64 mt-4 px-2">
                        <div className="w-full bg-[#234829] rounded-t-sm h-[40%] hover:bg-[#13ec37]/40 transition-colors"></div>
                        <div className="w-full bg-[#234829] rounded-t-sm h-[60%] hover:bg-[#13ec37]/40 transition-colors"></div>
                        <div className="w-full bg-[#234829] rounded-t-sm h-[45%] hover:bg-[#13ec37]/40 transition-colors"></div>
                        <div className="w-full bg-[#234829] rounded-t-sm h-[75%] hover:bg-[#13ec37]/40 transition-colors"></div>
                        <div className="w-full bg-[#234829] rounded-t-sm h-[55%] hover:bg-[#13ec37]/40 transition-colors"></div>
                        <div className="w-full bg-[#13ec37]/80 rounded-t-sm h-[90%] shadow-[0_0_10px_rgba(19,236,55,0.3)]"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming Pickups */}
                {upcomingPickups.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xl font-bold text-white">Upcoming Pickups</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {upcomingPickups.map((order) => {
                        const pickupDate = new Date(order.scheduledWindow.start);
                        const isToday = pickupDate.toDateString() === new Date().toDateString();
                        const isTomorrow = pickupDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

                        return (
                          <button
                            key={order.id}
                            onClick={() => setActiveTab('orders')}
                            className="bg-[#1c2e20] border border-[#234829] rounded-xl p-5 hover:border-[#13ec37]/50 transition-colors group text-left w-full"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="text-white font-semibold mb-1 line-clamp-1">{order.title}</h4>
                                <p className="text-[#92c99b] text-sm">{order.category}</p>
                              </div>
                              <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-xs font-medium border border-yellow-500/20">
                                Reserved
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-[#92c99b]">
                                <span className="material-symbols-outlined text-base">schedule</span>
                                <span>
                                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {', '}
                                  {pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-[#92c99b]">
                                <span className="material-symbols-outlined text-base">location_on</span>
                                <span className="line-clamp-1">{order.address}</span>
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-[#234829]">
                                <span className="text-[#92c99b] text-sm">Amount</span>
                                <span className="text-white font-bold">{order.currency} {order.price.toFixed(2)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Listings Table */}
                <div className="flex flex-col gap-8 pb-8">
                  <div className="w-full flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-white">Recent Listings</h3>
                      <button
                        onClick={() => setActiveTab('inventory')}
                        className="text-sm text-[#13ec37] font-medium hover:underline"
                      >
                        View All
                      </button>
                    </div>

                    {recentListings.length > 0 ? (
                      <div className="bg-[#1c2e20] border border-[#234829] rounded-xl overflow-hidden shadow-lg w-full">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#234829] text-[#92c99b] text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">Waste Item</th>
                                <th className="p-4 font-medium">Quantity</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Date Listed</th>
                              </tr>
                            </thead>
                            <tbody className="text-white text-sm divide-y divide-[#234829]">
                              {recentListings.map((listing) => (
                                <tr key={listing.id} className="group hover:bg-[#234829]/50 transition-colors">
                                  <td className="p-4">
                                    <Link href={`/generator/listings/${listing.id}`} className="flex items-center gap-3">
                                      <div className="size-8 rounded bg-[#234829] flex items-center justify-center text-[#13ec37]">
                                        <span className="material-symbols-outlined text-[20px]">{getCategoryIcon(listing.category)}</span>
                                      </div>
                                      <span className="font-medium">{listing.title}</span>
                                    </Link>
                                  </td>
                                  <td className="p-4 text-gray-300">{listing.weightKg ? `${listing.weightKg} kg` : 'N/A'}</td>
                                  <td className="p-4">
                                    {getStatusBadge(listing.status)}
                                  </td>
                                  <td className="p-4 text-right text-gray-400">{formatDate(listing.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-12 text-center">
                        <p className="text-[#92c99b] mb-4">
                          {searchQuery ? 'No listings match your search.' : listings.length === 0 ? 'No listings yet. Start by posting your first waste listing!' : 'No recent listings to display.'}
                        </p>
                        {(!searchQuery && listings.length === 0) && (
                          <Link
                            href="/generator/listings/new"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg shadow-[0_0_20px_rgba(19,236,55,0.3)] transition-all font-bold"
                          >
                            <span className="material-symbols-outlined">add</span>
                            List Waste
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : activeTab === 'inventory' ? (
              <>
                {/* Inventory Tab Content */}
                <div className="flex flex-col gap-6">
                  {/* Page Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">Waste Inventory</h2>
                      <p className="text-[#92c99b]">Manage all your waste listings</p>
                    </div>
                    <Link
                      href="/generator/listings/new"
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg shadow-[0_0_20px_rgba(19,236,55,0.3)] transition-all transform hover:scale-105 font-bold"
                    >
                      <span className="material-symbols-outlined">add</span>
                      List Waste
                    </Link>
                  </div>

                  {/* Listings Grid */}
                  {sortedListings.length > 0 ? (
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl overflow-hidden shadow-lg">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="border-b border-[#234829] text-[#92c99b] text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">Waste Item</th>
                                <th className="p-4 font-medium">Quantity</th>
                                <th className="p-4 font-medium">Price</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Date Listed</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                              </tr>
                          </thead>
                          <tbody className="text-white text-sm divide-y divide-[#234829]">
                            {sortedListings.map((listing) => (
                              <tr key={listing.id} className="group hover:bg-[#234829]/50 transition-colors">
                                <td className="p-4">
                                  <Link href={`/generator/listings/${listing.id}`} className="flex items-center gap-3">
                                    <div className="size-8 rounded bg-[#234829] flex items-center justify-center text-[#13ec37]">
                                      <span className="material-symbols-outlined text-[20px]">{getCategoryIcon(listing.category)}</span>
                                    </div>
                                    <span className="font-medium">{listing.title}</span>
                                  </Link>
                                </td>
                                <td className="p-4 text-gray-300">{listing.weightKg ? `${listing.weightKg} kg` : 'N/A'}</td>
                                <td className="p-4 text-gray-300">{listing.currency} {listing.price.toFixed(2)}</td>
                                <td className="p-4">
                                  {getStatusBadge(listing.status)}
                                </td>
                                <td className="p-4 text-right text-gray-400">
                                  {listing.createdAt ? (() => {
                                    const date = listing.createdAt.toDate ? listing.createdAt.toDate() : new Date(listing.createdAt);
                                    return date.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  })() : 'N/A'}
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2 justify-end">
                                    {listing.status === 'live' && (
                                      <>
                                        <Link
                                          href={`/generator/listings/${listing.id}/edit`}
                                          className="p-2 text-[#92c99b] hover:text-[#13ec37] hover:bg-[#234829] rounded-lg transition-colors"
                                          title="Edit"
                                        >
                                          <span className="material-symbols-outlined text-lg">edit</span>
                                        </Link>
                                        <button
                                          onClick={() => deleteListing(listing.id)}
                                          className="p-2 text-red-400 hover:text-red-300 hover:bg-[#234829] rounded-lg transition-colors"
                                          title="Delete"
                                        >
                                          <span className="material-symbols-outlined text-lg">delete</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-12 text-center">
                      <div className="mb-6">
                        <span className="material-symbols-outlined text-[#5d8265] text-6xl mb-4 inline-block">recycling</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {searchQuery ? 'No listings found' : 'No listings yet'}
                      </h3>
                      <p className="text-[#92c99b] mb-6">
                        {searchQuery ? 'Try adjusting your search terms.' : 'Start by posting your first waste listing and help reduce food waste!'}
                      </p>
                      {!searchQuery && (
                        <Link
                          href="/generator/listings/new"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg shadow-[0_0_20px_rgba(19,236,55,0.3)] transition-all font-bold"
                        >
                          <span className="material-symbols-outlined">add</span>
                          List Waste
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === 'orders' ? (
              <>
                {/* Orders Tab Content */}
                <div className="flex flex-col gap-6">
                  {/* Page Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">Orders</h2>
                      <p className="text-[#92c99b]">Manage all your orders</p>
                    </div>
                  </div>

                  {/* Status Tabs */}
                  <div className="flex gap-2 border-b border-[#234829]">
                    <button
                      onClick={() => setOrderStatusFilter('reserved')}
                      className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${orderStatusFilter === 'reserved'
                        ? 'text-[#13ec37] border-[#13ec37]'
                        : 'text-[#92c99b] border-transparent hover:text-white'
                        }`}
                    >
                      Reserved ({reservedOrders.length})
                    </button>
                    <button
                      onClick={() => setOrderStatusFilter('completed')}
                      className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${orderStatusFilter === 'completed'
                        ? 'text-[#13ec37] border-[#13ec37]'
                        : 'text-[#92c99b] border-transparent hover:text-white'
                        }`}
                    >
                      Completed ({completedOrders.length})
                    </button>
                    {cancelledOrders.length > 0 && (
                      <button
                        onClick={() => setOrderStatusFilter('cancelled')}
                        className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${orderStatusFilter === 'cancelled'
                          ? 'text-[#13ec37] border-[#13ec37]'
                          : 'text-[#92c99b] border-transparent hover:text-white'
                          }`}
                      >
                        Cancelled ({cancelledOrders.length})
                      </button>
                    )}
                  </div>

                  {/* Orders List */}
                  {sortedOrders.length > 0 ? (
                    <div className="space-y-4">
                      {sortedOrders.map((order) => {
                        const pickupDate = new Date(order.scheduledWindow.start);
                        const isToday = pickupDate.toDateString() === new Date().toDateString();
                        const isTomorrow = pickupDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

                        return (
                          <div key={order.id} className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 hover:border-[#13ec37]/50 transition-colors">
                            <div className="flex gap-4">
                              <img
                                src={order.imageUrl}
                                alt={order.title}
                                className="w-24 h-24 object-cover rounded-lg border border-[#234829]"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://via.placeholder.com/96';
                                }}
                              />
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h3 className="text-xl font-bold text-white">{order.title}</h3>
                                    <p className="text-sm text-[#92c99b]">{order.category}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'reserved'
                                    ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                    : order.status === 'completed'
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                  </span>
                                </div>
                                <p className="text-[#92c99b] text-sm mb-3">{order.address}</p>
                                <div className="flex justify-between items-center">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm text-[#92c99b]">
                                      <span className="material-symbols-outlined text-base">schedule</span>
                                      <span>
                                        Pickup: {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickupDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        {', '}
                                        {pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                      </span>
                                    </div>
                                    <p className="text-lg font-bold text-[#13ec37]">
                                      {order.currency} {order.price.toFixed(2)}
                                    </p>
                                  </div>
                                  {order.status === 'reserved' && (
                                    <button
                                      onClick={() => markCompleted(order.id)}
                                      className="px-4 py-2 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg font-semibold transition-all shadow-[0_0_15px_rgba(19,236,55,0.3)]"
                                    >
                                      Mark Completed
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-12 text-center">
                      <p className="text-[#92c99b] mb-4">
                        {orderStatusFilter === 'reserved' && 'No reserved orders yet.'}
                        {orderStatusFilter === 'completed' && 'No completed orders yet.'}
                        {orderStatusFilter === 'cancelled' && 'No cancelled orders.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === 'analytics' ? (
              <>
                {/* ESG Analytics Tab Content */}
                <div className="flex flex-col gap-8">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-white text-3xl font-black tracking-tight">ESG Analytics Report</h2>
                      <p className="text-[#92c99b] text-base font-normal">Comprehensive sustainability metrics and impact overview</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[#92c99b] hidden sm:block">Date Range:</span>
                      <button className="flex items-center gap-2 px-4 py-2 bg-[#1c2e20] border border-[#234829] rounded-lg text-white text-sm hover:bg-[#234829] transition-colors group">
                        <span>Last 90 Days</span>
                        <span className="material-symbols-outlined text-[18px] text-[#92c99b] group-hover:text-white">calendar_today</span>
                      </button>
                    </div>
                  </div>

                  {/* Key Metrics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total CO2 Saved */}
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 flex flex-col justify-between h-36 relative overflow-hidden group">
                      <div className="absolute -right-2 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="material-symbols-outlined text-[120px] text-white">cloud_off</span>
                      </div>
                      <div className="flex justify-between items-start z-10">
                        <p className="text-[#92c99b] font-medium text-sm uppercase tracking-wide">Total CO2 Saved</p>
                        <span className="flex items-center text-[#13ec37] text-xs font-bold bg-[#13ec37]/10 px-2 py-0.5 rounded-full border border-[#13ec37]/20">
                          <span className="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                          +12.5%
                        </span>
                      </div>
                      <div className="z-10 mt-auto">
                        <h3 className="text-3xl font-bold text-white tracking-tight">
                          {totalCo2Saved.toFixed(1)} <span className="text-lg text-[#92c99b] font-normal">Tons</span>
                        </h3>
                        <p className="text-xs text-[#5d8265] mt-1">vs {Math.max(0, totalCo2Saved * 0.89).toFixed(1)} tons last quarter</p>
                      </div>
                    </div>

                    {/* Waste Diversion Rate */}
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 flex flex-col justify-between h-36 relative overflow-hidden group">
                      <div className="absolute -right-2 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="material-symbols-outlined text-[120px] text-white">recycling</span>
                      </div>
                      <div className="flex justify-between items-start z-10">
                        <p className="text-[#92c99b] font-medium text-sm uppercase tracking-wide">Waste Diversion Rate</p>
                        <span className="flex items-center text-[#13ec37] text-xs font-bold bg-[#13ec37]/10 px-2 py-0.5 rounded-full border border-[#13ec37]/20">
                          <span className="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                          +5.2%
                        </span>
                      </div>
                      <div className="z-10 mt-auto">
                        <h3 className="text-3xl font-bold text-white tracking-tight">
                          {wasteDiversionRate} <span className="text-lg text-[#92c99b] font-normal">%</span>
                        </h3>
                        <p className="text-xs text-[#5d8265] mt-1">Goal: {goalDiversionRate}% by EOY</p>
                      </div>
                    </div>

                    {/* Cost Savings */}
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 flex flex-col justify-between h-36 relative overflow-hidden group">
                      <div className="absolute -right-2 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <span className="material-symbols-outlined text-[120px] text-white">savings</span>
                      </div>
                      <div className="flex justify-between items-start z-10">
                        <p className="text-[#92c99b] font-medium text-sm uppercase tracking-wide">Total Earnings</p>
                        <span className="flex items-center text-[#13ec37] text-xs font-bold bg-[#13ec37]/10 px-2 py-0.5 rounded-full border border-[#13ec37]/20">
                          <span className="material-symbols-outlined text-[14px] mr-0.5">trending_up</span>
                          +8.4%
                        </span>
                      </div>
                      <div className="z-10 mt-auto">
                        <h3 className="text-3xl font-bold text-white tracking-tight">
                          {currency} {costSavings.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </h3>
                        <p className="text-xs text-[#5d8265] mt-1">From completed transactions</p>
                      </div>
                    </div>
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Progress Chart */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 shadow-lg">
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h3 className="text-white font-bold text-lg">Monthly Sustainability Progress</h3>
                            <p className="text-xs text-[#92c99b]">Waste diverted over time</p>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full bg-[#13ec37] inline-block shadow-[0_0_8px_rgba(19,236,55,0.6)]"></span>
                              <span className="text-xs text-[#92c99b] font-medium">Actual</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-full bg-[#234829] inline-block border border-white/20"></span>
                              <span className="text-xs text-[#92c99b] font-medium">Target</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-full h-72 relative">
                          <div className="absolute inset-0 flex flex-col justify-between text-xs text-[#5d8265] pointer-events-none pb-6">
                            <div className="border-b border-[#234829] border-dashed w-full h-0"></div>
                            <div className="border-b border-[#234829] border-dashed w-full h-0"></div>
                            <div className="border-b border-[#234829] border-dashed w-full h-0"></div>
                            <div className="border-b border-[#234829] border-dashed w-full h-0"></div>
                            <div className="border-b border-[#234829] border-dashed w-full h-0"></div>
                          </div>
                          <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <defs>
                              <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#13ec37" stopOpacity="0.2"></stop>
                                <stop offset="100%" stopColor="#13ec37" stopOpacity="0"></stop>
                              </linearGradient>
                            </defs>
                            {/* Draw line chart based on monthly data */}
                            {monthlyData.length > 0 && (
                              <>
                                <path 
                                  d={`M0,${100 - (monthlyData[0].actual / 50) * 100} Q33,${100 - (monthlyData[1].actual / 50) * 100} 66,${100 - (monthlyData[1].actual / 50) * 100} T100,${100 - (monthlyData[monthlyData.length - 1].actual / 50) * 100} V100 H0 Z`}
                                  fill="url(#chartGradient)"
                                ></path>
                                <path 
                                  d={`M0,${100 - (monthlyData[0].actual / 50) * 100} Q33,${100 - (monthlyData[1].actual / 50) * 100} 66,${100 - (monthlyData[1].actual / 50) * 100} T100,${100 - (monthlyData[monthlyData.length - 1].actual / 50) * 100}`}
                                  fill="none" 
                                  stroke="#13ec37" 
                                  strokeLinecap="round" 
                                  strokeWidth="2.5" 
                                  vectorEffect="non-scaling-stroke"
                                ></path>
                                {monthlyData.map((_, i) => {
                                  const x = (i / (monthlyData.length - 1)) * 100;
                                  const y = 100 - (monthlyData[i].actual / 50) * 100;
                                  return (
                                    <circle 
                                      key={i}
                                      className="fill-[#102213] stroke-[#13ec37] stroke-[2px]" 
                                      cx={x} 
                                      cy={y} 
                                      r="4" 
                                      vectorEffect="non-scaling-stroke"
                                    ></circle>
                                  );
                                })}
                                {/* Target line */}
                                <path 
                                  d="M0,60 L100,40" 
                                  fill="none" 
                                  stroke="#5d8265" 
                                  strokeDasharray="4,4" 
                                  strokeWidth="1.5" 
                                  vectorEffect="non-scaling-stroke"
                                ></path>
                              </>
                            )}
                          </svg>
                          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs font-medium text-[#92c99b] px-1 transform translate-y-full pt-2">
                            {monthlyData.map((data, i) => (
                              <span key={i}>{data.month}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Impact Breakdown */}
                      <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 shadow-lg">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
                          <div className="flex-1">
                            <h3 className="text-white font-bold text-lg mb-1">Impact Breakdown</h3>
                            <p className="text-xs text-[#92c99b] mb-6">Distribution by waste category</p>
                            <div className="grid grid-cols-1 gap-3 w-full">
                              {impactBreakdown.map((item, index) => {
                                const colors = ['#13ec37', '#60a5fa', '#facc15'];
                                const color = colors[index % colors.length];
                                return (
                                  <div 
                                    key={item.category}
                                    className="flex items-center justify-between p-3 rounded-lg bg-[#112214] border border-[#234829] hover:border-[#13ec37]/30 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span 
                                        className="size-3 rounded-full shadow-[0_0_8px_rgba(19,236,55,0.4)]"
                                        style={{ backgroundColor: color, boxShadow: `0_0_8px_${color}66` }}
                                      ></span>
                                      <span className="text-sm text-white font-medium">{item.category}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="block text-sm text-white font-bold">{item.percentage}%</span>
                                      <span className="block text-[10px] text-[#5d8265]">{item.weight} kg</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* Donut Chart */}
                          <div className="relative size-56 flex-shrink-0">
                            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                              <path 
                                className="text-[#234829]" 
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="3"
                              ></path>
                              {impactBreakdown.map((item, index) => {
                                const colors = ['#13ec37', '#60a5fa', '#facc15'];
                                const color = colors[index % colors.length];
                                const percentage = item.percentage;
                                const offset = impactBreakdown.slice(0, index).reduce((sum, i) => sum + i.percentage, 0);
                                const circumference = 100;
                                const dashOffset = circumference - (percentage / 100) * circumference;
                                
                                return (
                                  <path 
                                    key={item.category}
                                    className="hover:opacity-80 transition-opacity cursor-pointer" 
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                    fill="none" 
                                    stroke={color}
                                    strokeDasharray={`${percentage}, 100`} 
                                    strokeDashoffset={`-${offset}`}
                                    strokeWidth="3"
                                  ></path>
                                );
                              })}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-3xl font-black text-white tracking-tight">{totalBreakdownWeight}</span>
                              <span className="text-xs font-medium text-[#92c99b] uppercase tracking-wide">Total Kg</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      {/* Full Report */}
                      <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                          <span className="material-symbols-outlined text-[100px] text-white">description</span>
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-4 text-white">
                            <div className="flex items-center justify-center size-10 rounded-full bg-[#13ec37]/20 text-[#13ec37]">
                              <span className="material-symbols-outlined">cloud_download</span>
                            </div>
                            <h3 className="font-bold text-lg">Full Report</h3>
                          </div>
                          <p className="text-sm text-[#92c99b] mb-6 leading-relaxed">
                            Export your full sustainability metrics and waste logs for external reporting and audits.
                          </p>
                          <div className="flex flex-col gap-3">
                            <button 
                              onClick={() => toast.success('PDF export coming soon!')}
                              className="flex items-center justify-center gap-2 w-full py-3 bg-white hover:bg-gray-100 text-[#102213] rounded-lg font-bold transition-all shadow-md group"
                            >
                              <span className="material-symbols-outlined text-[20px] text-red-600 group-hover:scale-110 transition-transform">picture_as_pdf</span>
                              Download PDF
                            </button>
                            <button 
                              onClick={() => toast.success('CSV export coming soon!')}
                              className="flex items-center justify-center gap-2 w-full py-3 bg-[#234829] text-white rounded-lg font-medium hover:bg-[#2d5c35] transition-colors border border-[#5d8265]/30 group"
                            >
                              <span className="material-symbols-outlined text-[20px] text-green-400 group-hover:scale-110 transition-transform">table_chart</span>
                              Export CSV
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Top Performing Categories */}
                      <div className="bg-[#1c2e20] border border-[#234829] rounded-xl overflow-hidden shadow-lg">
                        <div className="p-4 border-b border-[#234829] flex justify-between items-center bg-[#1c2e20]">
                          <h3 className="font-bold text-white text-sm">Top Categories</h3>
                          <span className="material-symbols-outlined text-[#5d8265] text-sm">trophy</span>
                        </div>
                        <div className="divide-y divide-[#234829]">
                          {impactBreakdown.slice(0, 3).map((item, index) => (
                            <div 
                              key={item.category}
                              className="p-4 flex items-center justify-between group hover:bg-[#234829]/50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className={`size-8 rounded-full flex items-center justify-center border font-black text-xs ${
                                    index === 0 
                                      ? 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                                      : 'bg-[#112214] border-[#234829] text-gray-400'
                                  }`}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white group-hover:text-[#13ec37] transition-colors">{item.category}</p>
                                  <p className="text-xs text-[#92c99b]">{item.percentage}% Diversion Rate</p>
                                </div>
                              </div>
                              <span className="material-symbols-outlined text-[#5d8265] group-hover:text-white transition-colors">chevron_right</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Pro Tip */}
                      <div className="bg-gradient-to-br from-[#13ec37]/20 to-[#1c2e20] border border-[#13ec37]/20 rounded-xl p-5 relative overflow-hidden">
                        <div className="flex items-start gap-3 relative z-10">
                          <span className="material-symbols-outlined text-[#13ec37]">lightbulb</span>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-white uppercase tracking-wider">Pro Tip</p>
                            <p className="text-xs text-[#92c99b] leading-relaxed">
                              Separating coffee grounds can increase your organic diversion by up to 15%.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Find Farmers Map Tab Content */}
                <div className="flex flex-col gap-6">
                  {/* Page Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">Find Farmers</h2>
                      <p className="text-[#92c99b]">View available farmers on the map</p>
                    </div>
                    {farmers.length > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[#1c2e20] border border-[#234829] rounded-lg">
                        <span className="material-symbols-outlined text-[#13ec37] text-lg">people</span>
                        <span className="text-white font-medium">{farmers.length}</span>
                        <span className="text-[#92c99b] text-sm">Farmers nearby</span>
                      </div>
                    )}
                  </div>

                  {/* Map Container */}
                  <div className="bg-[#1c2e20] border border-[#234829] rounded-xl overflow-hidden shadow-lg" style={{ height: '600px', minHeight: '600px' }}>
                    <FarmerMapView
                      farmers={farmers}
                      generatorLocation={userProfile?.location}
                      onFarmerSelect={(farmer) => {
                        console.log('Selected farmer:', farmer);
                      }}
                    />
                  </div>

                  {/* Farmer List */}
                  {farmers.length > 0 && (
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-white mb-4">Available Farmers ({farmers.length})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-64 overflow-y-auto">
                        {farmers.map((farmer) => (
                          <div
                            key={farmer.id}
                            className="p-4 bg-[#234829] rounded-lg border border-[#234829] hover:border-[#13ec37]/50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              <div className="bg-[#13ec37]/10 rounded-full p-2">
                                <span className="material-symbols-outlined text-[#13ec37] text-xl">person</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-white truncate">{farmer.name || 'Farmer'}</h4>
                                {farmer.location?.address && (
                                  <p className="text-sm text-[#92c99b] truncate mt-1">{farmer.location.address}</p>
                                )}
                                {farmer.searchRadiusKm && (
                                  <p className="text-xs text-[#5d8265] mt-1">
                                    Search radius: {farmer.searchRadiusKm} km
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {farmers.length === 0 && !loading && (
                    <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-12 text-center">
                      <span className="material-symbols-outlined text-[#5d8265] text-6xl mb-4">map</span>
                      <p className="text-[#92c99b] text-lg mb-2">No farmers found</p>
                      <p className="text-[#5d8265] text-sm">Farmers will appear here once they register and set their location.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}