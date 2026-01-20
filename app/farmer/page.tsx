'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, getFirestoreDb, signOut, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplaceOrder } from '@/lib/types';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
  const [searchRadius, setSearchRadius] = useState(10);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'distance' | 'price-low' | 'price-high' | 'date'>('distance');

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

  // Load upcoming orders for the farmer
  useEffect(() => {
    if (!user) return;

    const db = getFirestoreDb();
    const ordersRef = collection(db, getOrdersCollectionPath());
    const q = query(
      ordersRef,
      where('farmerUid', '==', user.uid),
      where('status', '==', 'reserved')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketplaceOrder[];
      
      // Filter to only upcoming orders (scheduledWindow.start is in the future)
      const now = new Date();
      const upcoming = ordersData.filter((order) => {
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
    if (!userProfile?.location?.latitude || !userProfile?.location?.longitude) {
      setFilteredListings(listings);
      return;
    }

    const filtered = listings.filter((listing) => {
      const distance = calculateDistance(
        userProfile.location!.latitude,
        userProfile.location!.longitude,
        listing.latitude,
        listing.longitude
      );
      return distance <= searchRadius;
    });

    // Sort by distance
    filtered.sort((a, b) => {
      const distA = calculateDistance(
        userProfile.location!.latitude,
        userProfile.location!.longitude,
        a.latitude,
        a.longitude
      );
      const distB = calculateDistance(
        userProfile.location!.latitude,
        userProfile.location!.longitude,
        b.latitude,
        b.longitude
      );
      return distA - distB;
    });

    setFilteredListings(filtered);
  }, [listings, userProfile, searchRadius]);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      <header className="bg-white backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/farmer" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                ReFeed
              </h1>
            </Link>

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
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Settings
                      </Link>
                      <Link
                        href="/orders"
                        className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/schedule"
                        className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
        {/* Upcoming Pickups */}
        {upcomingOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Upcoming Pickups</h2>
              <Link
                href="/orders"
                className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
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
                    href="/orders"
                    className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-200 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">{order.title}</h3>
                        <p className="text-sm text-gray-600">{order.address}</p>
                      </div>
                      <img src={order.imageUrl} alt={order.title} className="w-16 h-16 object-cover rounded-lg ml-2" />
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-semibold text-emerald-700">
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickupDate.toLocaleDateString()}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600">
                        {pickupDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(order.scheduledWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-sm font-bold text-emerald-600 mt-2">
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
                  href="/orders"
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  +{upcomingOrders.length - 3} more upcoming pickup{upcomingOrders.length - 3 > 1 ? 's' : ''}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <div className="flex flex-col gap-6">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="material-symbols-outlined text-gray-400">search</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, category, or address..."
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search Radius */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Search Radius: <span className="text-emerald-700">{searchRadius} km</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={searchRadius}
                  onChange={(e) => updateRadius(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1km</span>
                  <span>20km</span>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-semibold text-gray-900">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                >
                  <option value="">All Categories</option>
                  {Array.from(new Set(listings.map(l => l.category))).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-semibold text-gray-900">Price Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={priceFilter.min}
                    onChange={(e) => setPriceFilter({ ...priceFilter, min: e.target.value })}
                    placeholder="Min"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                  <input
                    type="number"
                    value={priceFilter.max}
                    onChange={(e) => setPriceFilter({ ...priceFilter, max: e.target.value })}
                    placeholder="Max"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                  />
                </div>
              </div>

              {/* Sort By */}
              <div className="flex flex-col gap-2">
                <label className="block text-sm font-semibold text-gray-900">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900"
                >
                  <option value="distance">Distance</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="date">Newest First</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex gap-2">
                {(searchQuery || categoryFilter || priceFilter.min || priceFilter.max) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('');
                      setPriceFilter({ min: '', max: '' });
                    }}
                    className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">clear</span>
                    Clear Filters
                  </button>
                )}
              </div>
              <Link
                href="/farmer/map"
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg font-semibold flex items-center gap-2"
              >
                <span className="material-symbols-outlined">map</span>
                View Map
              </Link>
            </div>
          </div>
        </div>

        {/* Listings Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Available Listings ({filteredListings.length})
          </h2>
          
          {filteredListings.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <div className="mb-6">
                <span className="material-symbols-outlined text-gray-300 text-6xl mb-4 inline-block">search_off</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {listings.length === 0 ? 'No listings available yet' : 'No listings found'}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
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
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                >
                  Clear All Filters
                </button>
              )}
              {searchRadius < 20 && !searchQuery && !categoryFilter && !priceFilter.min && !priceFilter.max && (
                <button
                  onClick={() => updateRadius(20)}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
                >
                  Increase Search Radius
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => {
                const distance = userProfile?.location?.latitude && userProfile?.location?.longitude
                  ? calculateDistance(
                      userProfile.location.latitude,
                      userProfile.location.longitude,
                      listing.latitude,
                      listing.longitude
                    ).toFixed(1)
                  : 'N/A';

                return (
                  <Link
                    key={listing.id}
                    href={`/farmer/listings/${listing.id}`}
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200 overflow-hidden"
                  >
                    <img src={listing.imageUrl} alt={listing.title} className="w-full h-48 object-cover" />
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900">{listing.title}</h3>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          {listing.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{listing.address}</p>
                      <div className="flex justify-between items-center">
                        <p className="text-lg font-bold text-emerald-600">
                          {listing.currency} {listing.price.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">{distance} km away</p>
                      </div>
                      {listing.weightKg && (
                        <p className="text-xs text-gray-500 mt-1">~{listing.weightKg} kg</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

