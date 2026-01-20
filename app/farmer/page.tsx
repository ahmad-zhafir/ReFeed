'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, signOut, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplaceOrder } from '@/lib/types';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';
import FarmerListingMap from '@/components/FarmerListingMap';
// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function FarmerFeed() {
  return (
    <RoleGuard allowedRoles={['farmer']}>
      <FarmerFeedContent />
    </RoleGuard>
  );
}

function FarmerFeedContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<MarketplaceListing[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<MarketplaceOrder[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [searchRadius, setSearchRadius] = useState(10);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'distance' | 'price-low' | 'price-high' | 'date'>('distance');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Helper functions
  const getNextPickupTime = (listing: MarketplaceListing): string => {
    if (!listing.pickupWindows || listing.pickupWindows.length === 0) {
      return 'No pickup window';
    }
    
    const now = new Date();
    const upcomingWindows = listing.pickupWindows
      .map(w => ({ start: new Date(w.start), end: new Date(w.end) }))
      .filter(w => w.start >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    if (upcomingWindows.length === 0) {
      // No upcoming windows, show the last available pickup window
      const allWindows = listing.pickupWindows
        .map(w => ({ start: new Date(w.start), end: new Date(w.end) }))
        .sort((a, b) => b.end.getTime() - a.end.getTime()); // Sort by end time, latest first
      
      if (allWindows.length === 0) {
        return 'No pickup window';
      }
      
      const lastWindow = allWindows[0];
      const endDate = lastWindow.end;
      
      // Format as "Pickup by [date and time]"
      const hours = endDate.getHours();
      const minutes = endDate.getMinutes();
      
      if (hours === 23 && minutes === 59) {
        const dateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `Pickup by ${dateStr}`;
      }
      
      const dateStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `Pickup by ${dateStr}, ${timeStr}`;
    }
    
    const nextWindow = upcomingWindows[0];
    const endDate = nextWindow.end;
    
    // Format as "Pickup by [time]" or "Pickup Anytime"
    const hours = endDate.getHours();
    const minutes = endDate.getMinutes();
    
    if (hours === 23 && minutes === 59) {
      return 'Pickup Anytime';
    }
    
    const timeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `Pickup by ${timeStr}`;
  };

  const getCategoryDisplayName = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'Vegetative': 'Vegetative',
      'Vegetative Waste': 'Vegetative', // Backward compatibility
      'Bakery': 'Bakery',
      'Dairy': 'Dairy',
      'Meat': 'Meat',
      'Fruit Scraps & Rinds': 'Fruit Scraps & Rinds',
      'Leafy Greens': 'Leafy Greens',
      'Others': 'Others',
      'Other': 'Others', // Backward compatibility
      'Prepared Food': 'Prepared Food', // Backward compatibility
      'Beverages': 'Beverages', // Backward compatibility
    };
    return categoryMap[category] || category;
  };

  const getQualityInfo = (listing: MarketplaceListing): string => {
    if (listing.notes?.toLowerCase().includes('contaminant') || listing.notes?.toLowerCase().includes('free')) {
      return 'Contaminant Free';
    }
    if (listing.notes?.toLowerCase().includes('fresh')) {
      return 'Fresh Scraps';
    }
    if (listing.notes?.toLowerCase().includes('crushed') || listing.notes?.toLowerCase().includes('ground')) {
      return 'Crushed';
    }
    if (listing.notes?.toLowerCase().includes('sorted')) {
      return 'Sorted';
    }
    return 'Good Quality';
  };

  // Get unique categories for filter chips
  const uniqueCategories = Array.from(new Set(listings.map(l => l.category)));

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);

        if (profile?.searchRadiusKm) {
          setSearchRadius(profile.searchRadiusKm);
        }

        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const db = getFirestoreDb();
    const listingsRef = collection(db, getListingsCollectionPath());
    const q = query(listingsRef, where('status', '==', 'live'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketplaceListing[];
      setListings(listingsData);
    });

    return () => unsubscribe();
  }, []);

  // Load all orders for the farmer (for stats)
  useEffect(() => {
    if (!user) return;

    const db = getFirestoreDb();
    const ordersRef = collection(db, getOrdersCollectionPath());
    const q = query(ordersRef, where('farmerUid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketplaceOrder[];

      setOrders(ordersData);

      // Filter to only upcoming orders (scheduledWindow.start is in the future)
      const now = new Date();
      const reservedOrders = ordersData.filter((order) => order.status === 'reserved');
      const upcoming = reservedOrders.filter((order) => {
        const pickupStart = new Date(order.scheduledWindow.start);
        return pickupStart >= now;
      });

      // Sort by pickup time (soonest first)
      upcoming.sort((a, b) => {
        const timeA = new Date(a.scheduledWindow.start).getTime();
        const timeB = new Date(b.scheduledWindow.start).getTime();
        return timeA - timeB;
      });

      setUpcomingOrders(upcoming);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let filtered = listings;

    // Filter by search radius and location
    if (userProfile?.location?.latitude && userProfile?.location?.longitude) {
      filtered = filtered.filter((listing) => {
        const distance = calculateDistance(
          userProfile.location!.latitude,
          userProfile.location!.longitude,
          listing.latitude,
          listing.longitude
        );
        return distance <= searchRadius;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter((listing) =>
        listing.title.toLowerCase().includes(queryLower) ||
        listing.category.toLowerCase().includes(queryLower) ||
        listing.address.toLowerCase().includes(queryLower) ||
        listing.notes?.toLowerCase().includes(queryLower) ||
        listing.generatorName?.toLowerCase().includes(queryLower)
      );
    }

    // Filter by category
    if (categoryFilter) {
      filtered = filtered.filter((listing) => listing.category === categoryFilter);
    }

    // Filter by price range
    if (priceFilter.min || priceFilter.max) {
      filtered = filtered.filter((listing) => {
        const price = listing.price;
        const min = priceFilter.min ? parseFloat(priceFilter.min) : 0;
        const max = priceFilter.max ? parseFloat(priceFilter.max) : Infinity;
        return price >= min && price <= max;
      });
    }

    // Sort listings
    filtered.sort((a, b) => {
      if (sortBy === 'distance' && userProfile?.location) {
        const distA = calculateDistance(
          userProfile.location.latitude,
          userProfile.location.longitude,
          a.latitude,
          a.longitude
        );
        const distB = calculateDistance(
          userProfile.location.latitude,
          userProfile.location.longitude,
          b.latitude,
          b.longitude
        );
        return distA - distB;
      } else if (sortBy === 'price-low') {
        return a.price - b.price;
      } else if (sortBy === 'price-high') {
        return b.price - a.price;
      } else if (sortBy === 'date') {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      }
      return 0;
    });

    setFilteredListings(filtered);
  }, [listings, userProfile, searchRadius, searchQuery, categoryFilter, priceFilter, sortBy]);

  const updateRadius = async (newRadius: number) => {
    setSearchRadius(newRadius);
    if (user) {
      try {
        await updateUserProfile(user.uid, { searchRadiusKm: newRadius });
      } catch (error) {
        console.error('Failed to save radius:', error);
      }
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
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen flex flex-col">
      {/* Top Navigation - Same as Generator */}
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
                <Link href="/farmer" className="text-white font-medium text-sm border-b-2 border-[#13ec37] transition-colors">
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
                      </div>
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
                      >
                        Settings
                      </Link>
                      <Link
                        href="/orders"
                        className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/schedule"
                        className="block px-4 py-2 text-sm font-medium text-[#92c99b] hover:text-white hover:bg-[#234829] transition-colors"
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

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Calculate stats */}
        {(() => {
          const activeReservations = upcomingOrders.length;
          const completedPickups = orders.filter(o => o.status === 'completed').length;
          const totalSpending = orders.filter(o => o.status === 'completed' || o.status === 'reserved')
            .reduce((sum, order) => sum + order.price, 0);
          const availableListings = filteredListings.length;
          const currency = filteredListings[0]?.currency || 'MYR';
          const greeting = (() => {
            const hour = new Date().getHours();
            if (hour < 12) return 'Good Morning';
            if (hour < 17) return 'Good Afternoon';
            return 'Good Evening';
          })();

          return (
            <>
              {/* Header Section */}
              <div className="flex flex-col gap-1 mb-8">
                <h2 className="text-white text-3xl font-black tracking-tight">
                  {greeting}, {userProfile?.name || 'Farmer'}
                </h2>
                <p className="text-[#92c99b] text-base font-normal">Discover organic resources in your area.</p>
              </div>

              {/* Quick Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Active Reservations */}
                <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#92c99b] text-sm font-medium mb-1">Active Reservations</p>
                      <h3 className="text-3xl font-bold text-white">{activeReservations}</h3>
                    </div>
                    <div className="bg-yellow-500/10 rounded-full p-3">
                      <span className="material-symbols-outlined text-yellow-500 text-2xl">schedule</span>
                    </div>
                  </div>
                </div>

                {/* Available Listings */}
                <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#92c99b] text-sm font-medium mb-1">Available Listings</p>
                      <h3 className="text-3xl font-bold text-white">{availableListings}</h3>
                    </div>
                    <div className="bg-[#13ec37]/10 rounded-full p-3">
                      <span className="material-symbols-outlined text-[#13ec37] text-2xl">inventory</span>
                    </div>
                  </div>
                </div>

                {/* Total Pickups */}
                <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#92c99b] text-sm font-medium mb-1">Total Pickups</p>
                      <h3 className="text-3xl font-bold text-white">{completedPickups}</h3>
                    </div>
                    <div className="bg-blue-500/10 rounded-full p-3">
                      <span className="material-symbols-outlined text-blue-400 text-2xl">check_circle</span>
                    </div>
                  </div>
                </div>

                {/* Total Spending */}
                <div className="bg-[#1c2e20] border border-[#234829] rounded-xl p-6 relative overflow-hidden group hover:border-[#13ec37]/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#92c99b] text-sm font-medium mb-1">Total Spending</p>
                      <h3 className="text-2xl font-bold text-white">
                        {currency} {totalSpending.toFixed(2)}
                      </h3>
                    </div>
                    <div className="bg-emerald-500/10 rounded-full p-3">
                      <span className="material-symbols-outlined text-emerald-400 text-2xl">shopping_cart</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Upcoming Pickups */}
        {upcomingOrders.length > 0 && (
          <div className="bg-[#1c2e20] border border-[#234829] rounded-xl shadow-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Upcoming Pickups</h2>
              <Link
                href="/schedule"
                className="text-sm font-semibold text-[#13ec37] hover:text-[#11d632] transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingOrders.slice(0, 3).map((order) => {
                const pickupDate = new Date(order.scheduledWindow.start);
                const isToday = pickupDate.toDateString() === new Date().toDateString();
                const isTomorrow = pickupDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

                return (
                  <Link
                    key={order.id}
                    href="/schedule"
                    className="bg-[#112214] border border-[#234829] rounded-xl p-4 hover:border-[#13ec37]/50 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-white mb-1">{order.title}</h3>
                        <p className="text-sm text-[#92c99b]">{order.address}</p>
                      </div>
                      <img src={order.imageUrl} alt={order.title} className="w-16 h-16 object-cover rounded-lg ml-2" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-[#234829]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[#13ec37] text-sm">calendar_today</span>
                        <p className="text-sm font-semibold text-[#13ec37]">
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickupDate.toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-xs text-[#92c99b]">
                        {pickupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(order.scheduledWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm font-bold text-[#13ec37] mt-2">
                        {order.currency} {order.price.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            {upcomingOrders.length > 3 && (
              <div className="mt-4 text-center">
                <Link
                  href="/schedule"
                  className="text-sm font-semibold text-[#13ec37] hover:text-[#11d632] transition-colors"
                >
                  +{upcomingOrders.length - 3} more upcoming pickup{upcomingOrders.length - 3 > 1 ? 's' : ''}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Filters Toolbar */}
        <div className="flex flex-col xl:flex-row gap-6 mb-8 items-start xl:items-end justify-between bg-[#1a351f]/50 p-4 rounded-xl border border-[#32673b]/50">
          {/* Left: Radius & Chips */}
          <div className="flex flex-col md:flex-row gap-6 w-full xl:w-auto flex-1">
            {/* Radius Slider */}
            <div className="min-w-[240px]">
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-white">Search Radius</label>
                <span className="text-sm font-bold text-[#13ec37]">{searchRadius} km</span>
              </div>
              <div className="relative h-2 bg-[#234829] rounded-full">
                <div 
                  className="absolute left-0 top-0 h-full bg-[#13ec37] rounded-full transition-all duration-300" 
                  style={{ width: `${((searchRadius - 1) / (50 - 1)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  step={1}
                  value={searchRadius}
                  onChange={(e) => updateRadius(parseInt(e.target.value, 10))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 size-4 bg-[#13ec37] rounded-full shadow-lg border-2 border-[#112214] cursor-pointer hover:scale-110 transition-transform pointer-events-none"
                  style={{ left: `calc(${((searchRadius - 1) / (50 - 1)) * 100}% - 8px)` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1 text-xs text-[#92c99b]">
                <span>1km</span>
                <span>50km</span>
              </div>
            </div>

            {/* Category Chips */}
            <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`h-8 px-4 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                    !categoryFilter
                      ? 'bg-[#13ec37] text-[#112213] font-bold'
                      : 'bg-[#234829] border border-transparent hover:border-[#13ec37] text-white'
                  }`}
                >
                  <span>All</span>
                </button>
                {uniqueCategories.slice(0, 4).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                    className={`h-8 px-4 rounded-full text-sm font-medium transition-all ${
                      categoryFilter === cat
                        ? 'bg-[#13ec37] text-[#112213] font-bold'
                        : 'bg-[#234829] border border-transparent hover:border-[#13ec37] text-white'
                    }`}
                  >
                    {getCategoryDisplayName(cat)}
                  </button>
                ))}
            </div>
          </div>

          {/* Right: Sort */}
          <div className="w-full xl:w-auto min-w-[200px]">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none w-full bg-[#234829] text-white border border-[#32673b] rounded-lg py-2.5 pl-4 pr-10 focus:outline-none focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] cursor-pointer text-sm font-medium"
              >
                <option value="distance">Sort by: Nearest First</option>
                <option value="price-low">Sort by: Price (Low to High)</option>
                <option value="price-high">Sort by: Price (High to Low)</option>
                <option value="date">Sort by: Newest First</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#13ec37]">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>
        </div>

        {/* Split View Layout */}
        <div className="flex flex-col lg:flex-row gap-6 relative">
          {/* Feed (Left) - 2/3 width */}
          <div className="w-full lg:w-2/3">

            {filteredListings.length === 0 ? (
              <div className="text-center py-16 bg-[#1a351f] border border-[#32673b] rounded-xl">
                <div className="mb-6">
                  <span className="material-symbols-outlined text-[#5d8265] text-6xl mb-4 inline-block">search_off</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {listings.length === 0 ? 'No listings available yet' : 'No listings found'}
                </h3>
                <p className="text-[#92c99b] mb-6 max-w-md mx-auto">
                  {listings.length === 0
                    ? 'Check back later or browse the map to see available listings in your area.'
                    : `Try adjusting your filters or increasing your search radius (currently ${searchRadius}km).`}
                </p>
                {(searchQuery || categoryFilter || priceFilter.min || priceFilter.max) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('');
                      setPriceFilter({ min: '', max: '' });
                    }}
                    className="px-6 py-3 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg transition-colors font-bold"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredListings.map((listing) => {
                  const distance = userProfile?.location?.latitude && userProfile?.location?.longitude
                    ? calculateDistance(
                        userProfile.location.latitude,
                        userProfile.location.longitude,
                        listing.latitude,
                        listing.longitude
                      ).toFixed(1)
                    : 'N/A';

                  const pickupTime = getNextPickupTime(listing);
                  const qualityInfo = getQualityInfo(listing);

                  const isSelected = selectedListingId === listing.id;

                  return (
                    <article
                      id={`listing-card-${listing.id}`}
                      key={listing.id}
                      className={`bg-[#1a351f] border rounded-xl overflow-hidden hover:border-[#13ec37]/50 transition-all group cursor-pointer ${
                        isSelected 
                          ? 'border-[#13ec37] ring-2 ring-[#13ec37]/50 shadow-lg shadow-[#13ec37]/20 scale-[1.02]' 
                          : 'border-[#32673b]'
                      }`}
                      onClick={() => {
                        setSelectedListingId(listing.id);
                      }}
                      onMouseEnter={() => setSelectedListingId(listing.id)}
                    >
                      {/* Image with Overlays */}
                      <div className="relative h-48 overflow-hidden">
                        <div 
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                          style={{ backgroundImage: `url(${listing.imageUrl})` }}
                        ></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#112214] to-transparent opacity-80"></div>
                        
                        {/* VERIFIED Badge */}
                        <div className="absolute top-3 right-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#13ec37] text-[#112213] text-xs font-bold shadow-lg">
                            <span className="material-symbols-outlined text-[14px]">verified</span>
                            VERIFIED
                          </span>
                        </div>

                        {/* Pickup Time */}
                        <div className="absolute bottom-3 left-3">
                          <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-sm text-white text-xs font-medium border border-white/10">
                            {pickupTime}
                          </span>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold text-white group-hover:text-[#13ec37] transition-colors">
                              {listing.generatorName || listing.title}
                            </h3>
                            <div className="flex items-center gap-1 text-[#92c99b] text-sm mt-0.5">
                              <span className="material-symbols-outlined text-[16px] text-[#13ec37]">near_me</span>
                              <span>{distance} km away</span>
                            </div>
                          </div>
                          <div className="bg-[#234829] px-2.5 py-1 rounded-md text-white text-xs font-medium border border-[#32673b]">
                            {getCategoryDisplayName(listing.category)}
                          </div>
                        </div>

                        {/* Weight & Quality Grid */}
                        <div className="grid grid-cols-2 gap-2 py-3 border-t border-[#32673b]/50">
                          <div>
                            <p className="text-xs text-[#92c99b]">Est. Weight</p>
                            <p className="text-sm font-bold text-white">{listing.weightKg ? `${listing.weightKg} kg` : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#92c99b]">Quality</p>
                            <p className="text-sm font-bold text-white">{qualityInfo}</p>
                          </div>
                        </div>

                        {/* Claim Button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(`/farmer/listings/${listing.id}`);
                          }}
                          className={`w-full font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                            isSelected
                              ? 'bg-white hover:bg-gray-100 text-[#112214]'
                              : 'bg-[#13ec37] hover:bg-[#11d832] text-[#112214]'
                          }`}
                        >
                          <span>View Listing</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Map Sidebar (Right) - 1/3 width, sticky */}
          <div className="hidden lg:block lg:w-1/3 relative" style={{ transform: 'translateZ(0)' }}>
            <div className="sticky top-24 h-[calc(100vh-140px)] rounded-xl overflow-hidden border border-[#32673b] shadow-2xl bg-[#1a351f]" style={{ transform: 'translateZ(0)', willChange: 'transform', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              <FarmerListingMap
                listings={filteredListings}
                userProfile={userProfile}
                selectedListingId={selectedListingId}
                onListingSelect={(listing) => {
                  setSelectedListingId(listing?.id || null);
                  if (listing) {
                    router.push(`/farmer/listings/${listing.id}`);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}