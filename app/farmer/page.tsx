'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplaceOrder } from '@/lib/types';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import RatingDisplay from '@/components/RatingDisplay';
import Link from 'next/link';
import FarmerListingMap from '@/components/FarmerListingMap';
import { FarmerHeader } from '@/components/FarmerHeader';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortBy, setSortBy] = useState<'distance' | 'price-low' | 'price-high' | 'date'>('distance');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [generatorProfiles, setGeneratorProfiles] = useState<Record<string, UserProfile>>({});

  const getNextPickupTime = (listing: MarketplaceListing): string => {
    if (!listing.pickupWindows || listing.pickupWindows.length === 0) return 'No window';
    const now = new Date();
    const upcoming = listing.pickupWindows
      .map(w => ({ start: new Date(w.start), end: new Date(w.end) }))
      .filter(w => w.start >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    if (upcoming.length === 0) {
      const all = listing.pickupWindows.map(w => ({ start: new Date(w.start), end: new Date(w.end) }))
        .sort((a, b) => b.end.getTime() - a.end.getTime());
      if (all.length === 0) return 'No window';
      const last = all[0].end;
      const hours = last.getHours(), minutes = last.getMinutes();
      if (hours === 23 && minutes === 59) return `By ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return `By ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${last.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    const end = upcoming[0].end;
    if (end.getHours() === 23 && end.getMinutes() === 59) return 'Anytime';
    return `By ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  const getCategoryDisplayName = (category: string): string => {
    const map: Record<string, string> = {
      'Vegetative': 'Vegetative', 'Vegetative Waste': 'Vegetative', 'Bakery': 'Bakery',
      'Dairy': 'Dairy', 'Meat': 'Meat', 'Fruit Scraps & Rinds': 'Fruit Scraps & Rinds',
      'Leafy Greens': 'Leafy Greens', 'Others': 'Others', 'Other': 'Others',
      'Prepared Food': 'Prepared Food', 'Beverages': 'Beverages',
    };
    return map[category] || category;
  };

  const getQualityInfo = (listing: MarketplaceListing): string => {
    if (listing.notes?.toLowerCase().includes('contaminant') || listing.notes?.toLowerCase().includes('free')) return 'Contaminant Free';
    if (listing.notes?.toLowerCase().includes('fresh')) return 'Fresh Scraps';
    if (listing.notes?.toLowerCase().includes('crushed') || listing.notes?.toLowerCase().includes('ground')) return 'Crushed';
    if (listing.notes?.toLowerCase().includes('sorted')) return 'Sorted';
    return 'Good Quality';
  };

  const isListingNotExpired = (listing: MarketplaceListing): boolean => {
    if (!listing.expiryAt) return listing.pickupWindows?.some((w) => new Date(w.end) > new Date()) ?? false;
    const expiry = new Date(listing.expiryAt);
    if (Number.isNaN(expiry.getTime())) return listing.pickupWindows?.some((w) => new Date(w.end) > new Date()) ?? false;
    const hasUpcoming = listing.pickupWindows?.some((w) => new Date(w.end) > new Date()) ?? false;
    return expiry > new Date() && hasUpcoming;
  };

  const uniqueCategories = Array.from(new Set(listings.map(l => l.category)));

  useEffect(() => {
    const unsub = onAuthStateChange(async (cu) => {
      if (cu) {
        setUser(cu);
        const profile = await getUserProfile(cu.uid);
        setUserProfile(profile);
        if (profile?.searchRadiusKm) setSearchRadius(profile.searchRadiusKm);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const db = getFirestoreDb();
    const q = query(collection(db, getListingsCollectionPath()), where('status', '==', 'live'));
    const unsub = onSnapshot(q, async (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceListing[];
      const active = data.filter(isListingNotExpired);
      setListings(active);
      const profiles: Record<string, UserProfile> = {};
      const uids = Array.from(new Set(active.map(l => l.generatorUid)));
      for (const uid of uids) {
        try {
          const p = await getUserProfile(uid);
          if (p) profiles[uid] = p;
        } catch (e) { console.error(e); }
      }
      setGeneratorProfiles(profiles);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const db = getFirestoreDb();
    const q = query(collection(db, getOrdersCollectionPath()), where('farmerUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceOrder[];
      setOrders(data);
      const now = new Date();
      const reserved = data.filter((o) => o.status === 'reserved');
      const upcoming = reserved.filter((o) => new Date(o.scheduledWindow.start) >= now);
      upcoming.sort((a, b) => new Date(a.scheduledWindow.start).getTime() - new Date(b.scheduledWindow.start).getTime());
      setUpcomingOrders(upcoming);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    let filtered = listings;
    if (userProfile?.location?.latitude && userProfile?.location?.longitude) {
      filtered = filtered.filter((l) =>
        calculateDistance(userProfile.location!.latitude, userProfile.location!.longitude, l.latitude, l.longitude) <= searchRadius
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((l) =>
        l.title.toLowerCase().includes(q) || l.category.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) || l.notes?.toLowerCase().includes(q) ||
        l.generatorName?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter) filtered = filtered.filter((l) => l.category === categoryFilter);
    if (priceFilter.min || priceFilter.max) {
      filtered = filtered.filter((l) => {
        const min = priceFilter.min ? parseFloat(priceFilter.min) : 0;
        const max = priceFilter.max ? parseFloat(priceFilter.max) : Infinity;
        return l.price >= min && l.price <= max;
      });
    }
    filtered.sort((a, b) => {
      if (sortBy === 'distance' && userProfile?.location) {
        const dA = calculateDistance(userProfile.location.latitude, userProfile.location.longitude, a.latitude, a.longitude);
        const dB = calculateDistance(userProfile.location.latitude, userProfile.location.longitude, b.latitude, b.longitude);
        return dA - dB;
      }
      if (sortBy === 'price-low') return a.price - b.price;
      if (sortBy === 'price-high') return b.price - a.price;
      if (sortBy === 'date') return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      return 0;
    });
    setFilteredListings(filtered);
  }, [listings, userProfile, searchRadius, searchQuery, categoryFilter, priceFilter, sortBy]);

  const updateRadius = async (newRadius: number) => {
    setSearchRadius(newRadius);
    if (user) {
      try { await updateUserProfile(user.uid, { searchRadiusKm: newRadius }); }
      catch (e) { console.error(e); }
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropdownOpen]);

  if (loading) return <FarmerLoader />;

  const activeReservations = upcomingOrders.length;
  const completedPickups = orders.filter(o => o.status === 'completed').length;
  const totalSpending = orders.filter(o => o.status === 'completed' || o.status === 'reserved').reduce((s, o) => s + o.price, 0);
  const availableListings = filteredListings.length;
  const currency = filteredListings[0]?.currency || 'MYR';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col relative"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      {/* Atmosphere */}
      <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />
      <div className="pointer-events-none fixed inset-0"
           style={{ background: 'radial-gradient(900px 600px at 10% 0%, rgba(200,255,77,.06), transparent 60%)' }} />

      <FarmerHeader
        userProfile={userProfile}
        active="marketplace"
        profileDropdownOpen={profileDropdownOpen}
        setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef}
        router={router}
      />

      <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">

        {/* —— Editorial hero —— */}
        <section className="grid grid-cols-12 gap-x-6 gap-y-4 mb-12 rf-fade-up">
          <div className="col-span-12 flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-70">
              <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
              Forager&apos;s Almanac · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit' })}
            </div>
            <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
              Marketplace · Bench 01
            </span>
          </div>

          <h1 className="col-span-12 md:col-span-9 rf-headline text-[clamp(2.5rem,7vw,6rem)]">
            {greeting},
            <br />
            <span className="italic">{userProfile?.name?.split(' ')[0] || 'forager'}.</span>
          </h1>

          <p className="col-span-12 md:col-span-7 font-instrument italic text-xl md:text-2xl mt-4"
             style={{ color: 'rgba(241,234,216,.7)' }}>
            The kitchens have set out today&apos;s gather. <span style={{ color: 'var(--rf-sap)' }}>{availableListings}</span>{' '}
            {availableListings === 1 ? 'parcel waits' : 'parcels wait'} within {searchRadius}km.
          </p>
        </section>

        {/* —— Stat strip with giant numerals —— */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-12 border rounded-2xl overflow-hidden rf-fade-up"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.05)', animationDelay: '.1s' }}>
          <StatCell num={activeReservations} unit="open" label="reservations" hint="↻" />
          <StatCell num={availableListings} unit="parcels" label="within reach" hint="◍" />
          <StatCell num={completedPickups} unit="closed" label="loops completed" hint="✓" />
          <StatCell num={`${totalSpending.toFixed(0)}`} unit={currency} label="returned to the soil" hint="✺" />
        </section>

        {/* —— Upcoming pickups — field journal entries —— */}
        {upcomingOrders.length > 0 && (
          <section className="mb-14 rf-fade-up" style={{ animationDelay: '.2s' }}>
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="rf-eyebrow mb-2">Chapter 02 · The Day Ahead</div>
                <h2 className="font-fraunces fraunces-wonk text-4xl md:text-5xl font-light tracking-[-0.03em]"
                    style={{ color: 'var(--rf-bone)' }}>
                  Pickups <span className="italic font-instrument" style={{ color: 'var(--rf-sap)' }}>scheduled</span>
                </h2>
              </div>
              <Link href="/schedule"
                    className="font-mono-jb text-[11px] uppercase tracking-[0.25em] rf-dashed-rule pb-1 hover:text-[color:var(--rf-sap)] transition-colors">
                All entries →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingOrders.slice(0, 3).map((order, idx) => {
                const pickup = new Date(order.scheduledWindow.start);
                const isToday = pickup.toDateString() === new Date().toDateString();
                const isTomorrow = pickup.toDateString() === new Date(Date.now() + 86400000).toDateString();
                const num = String(idx + 1).padStart(2, '0');
                return (
                  <Link key={order.id} href="/schedule"
                        className="group rounded-2xl p-5 border transition-all hover:-translate-y-0.5 hover:bg-white/[0.02]"
                        style={{ borderColor: 'rgba(241,234,216,.12)', background: 'rgba(241,234,216,.025)' }}>
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        <img src={order.imageUrl} alt={order.title}
                             className="w-20 h-20 object-cover rounded-xl" />
                        <span className="absolute -top-2 -left-2 font-fraunces fraunces-wonk italic text-2xl font-light leading-none px-2"
                              style={{ color: 'var(--rf-sap)' }}>
                          {num}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-fraunces text-lg font-medium tracking-tight mb-1 truncate"
                            style={{ color: 'var(--rf-bone)' }}>
                          {order.title}
                        </h3>
                        <p className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60 truncate">
                          {order.address}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex items-end justify-between"
                         style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                      <div>
                        <p className="font-instrument italic text-base" style={{ color: 'var(--rf-sap)' }}>
                          {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickup.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                        <p className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60">
                          {pickup.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(order.scheduledWindow.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <p className="font-fraunces fraunces-wonk text-2xl font-light"
                         style={{ color: 'var(--rf-bone)' }}>
                        <span className="font-mono-jb text-[10px] mr-1 opacity-60">{order.currency}</span>
                        {order.price.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
            {upcomingOrders.length > 3 && (
              <div className="mt-6 text-center">
                <Link href="/schedule"
                      className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-70 hover:text-[color:var(--rf-sap)]">
                  +{upcomingOrders.length - 3} more {upcomingOrders.length - 3 === 1 ? 'entry' : 'entries'} →
                </Link>
              </div>
            )}
          </section>
        )}

        {/* —— Filters toolbar —— */}
        <section className="mb-10 rf-fade-up" style={{ animationDelay: '.25s' }}>
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="rf-eyebrow mb-2">Chapter 03 · The Gather</div>
              <h2 className="font-fraunces fraunces-wonk text-4xl md:text-5xl font-light tracking-[-0.03em]">
                Today&apos;s <span className="italic font-instrument" style={{ color: 'var(--rf-sap)' }}>parcels</span>
              </h2>
            </div>
            <Link href="/farmer/map"
                  className="font-mono-jb text-[11px] uppercase tracking-[0.25em] inline-flex items-center gap-2 px-4 py-2 rounded-full border hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'rgba(241,234,216,.2)' }}>
              <span className="material-symbols-outlined text-base">map</span>
              Map view
            </Link>
          </div>

          <div className="grid grid-cols-12 gap-6 p-6 rounded-2xl border"
               style={{ borderColor: 'rgba(241,234,216,.12)', background: 'rgba(241,234,216,.025)' }}>
            {/* Radius dial */}
            <div className="col-span-12 lg:col-span-4">
              <div className="flex items-baseline justify-between mb-3">
                <label className="rf-eyebrow">01 · Radius</label>
                <span className="font-fraunces fraunces-wonk italic text-3xl font-light leading-none"
                      style={{ color: 'var(--rf-sap)' }}>
                  {searchRadius}<span className="font-mono-jb text-xs ml-1 not-italic opacity-70">km</span>
                </span>
              </div>
              <div className="relative h-1.5 rounded-full" style={{ background: 'rgba(241,234,216,.1)' }}>
                <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                     style={{ width: `${((searchRadius - 1) / 49) * 100}%`, background: 'var(--rf-sap)' }} />
                <input type="range" min={1} max={50} step={1} value={searchRadius}
                       onChange={(e) => updateRadius(parseInt(e.target.value, 10))}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 pointer-events-none"
                     style={{ left: `calc(${((searchRadius - 1) / 49) * 100}% - 8px)`, background: 'var(--rf-sap)', borderColor: 'var(--rf-forest)' }} />
              </div>
              <div className="flex justify-between mt-2 font-mono-jb text-[9px] uppercase tracking-[0.2em] opacity-50">
                <span>1km</span><span>50km</span>
              </div>
            </div>

            {/* Categories */}
            <div className="col-span-12 lg:col-span-5">
              <label className="rf-eyebrow mb-3 block">02 · Specimen</label>
              <div className="flex flex-wrap gap-2">
                <CategoryChip label="All" active={!categoryFilter} onClick={() => setCategoryFilter('')} />
                {uniqueCategories.map((cat) => (
                  <CategoryChip key={cat} label={getCategoryDisplayName(cat)}
                                active={categoryFilter === cat}
                                onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)} />
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="col-span-12 lg:col-span-3">
              <label className="rf-eyebrow mb-3 block">03 · Sort</label>
              <div className="relative">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                        className="appearance-none w-full rf-input py-2.5 pl-4 pr-10 font-mono-jb text-[11px] uppercase tracking-[0.18em] cursor-pointer">
                  <option value="distance">Nearest first</option>
                  <option value="price-low">Price · Low to high</option>
                  <option value="price-high">Price · High to low</option>
                  <option value="date">Newest first</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: 'var(--rf-sap)' }}>expand_more</span>
              </div>
            </div>
          </div>
        </section>

        {/* —— Split: feed + map —— */}
        <div className="flex flex-col lg:flex-row gap-8 relative">
          <div className="w-full lg:w-2/3">
            {filteredListings.length === 0 ? (
              <EmptyState
                hasFilters={!!(searchQuery || categoryFilter || priceFilter.min || priceFilter.max)}
                radius={searchRadius}
                totalListings={listings.length}
                onClear={() => { setSearchQuery(''); setCategoryFilter(''); setPriceFilter({ min: '', max: '' }); }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredListings.map((listing, idx) => {
                  const distance = userProfile?.location?.latitude && userProfile?.location?.longitude
                    ? calculateDistance(userProfile.location.latitude, userProfile.location.longitude, listing.latitude, listing.longitude).toFixed(1)
                    : 'N/A';
                  const pickupTime = getNextPickupTime(listing);
                  const quality = getQualityInfo(listing);
                  const isSelected = selectedListingId === listing.id;
                  const num = String(idx + 1).padStart(3, '0');
                  return (
                    <SpecimenCard
                      key={listing.id}
                      listing={listing}
                      num={num}
                      distance={distance}
                      pickupTime={pickupTime}
                      quality={quality}
                      category={getCategoryDisplayName(listing.category)}
                      generatorProfile={generatorProfiles[listing.generatorUid]}
                      isSelected={isSelected}
                      onSelect={() => setSelectedListingId(listing.id)}
                      onView={() => router.push(`/farmer/listings/${listing.id}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Map sidebar */}
          <div className="hidden lg:block lg:w-1/3 relative" style={{ transform: 'translateZ(0)' }}>
            <div className="sticky top-24 h-[calc(100vh-140px)] rounded-2xl overflow-hidden border shadow-2xl"
                 style={{ borderColor: 'rgba(241,234,216,.14)', background: 'var(--rf-moss)', transform: 'translateZ(0)', willChange: 'transform' }}>
              <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full backdrop-blur-md font-mono-jb text-[10px] uppercase tracking-[0.25em]"
                   style={{ background: 'rgba(13,26,16,.7)', color: 'var(--rf-bone)', border: '1px solid rgba(241,234,216,.15)' }}>
                ◍ Live field
              </div>
              <FarmerListingMap
                listings={filteredListings}
                userProfile={userProfile}
                selectedListingId={selectedListingId}
                onListingSelect={(listing) => {
                  setSelectedListingId(listing?.id || null);
                  if (listing) router.push(`/farmer/listings/${listing.id}`);
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* —— Small components —— */
function StatCell({ num, unit, label, hint }: { num: number | string; unit?: string; label: string; hint?: string }) {
  return (
    <div className="p-6 flex flex-col justify-between min-h-[140px]" style={{ background: 'var(--rf-forest)' }}>
      <div className="flex items-start justify-between">
        <span className="font-fraunces fraunces-wonk text-5xl md:text-6xl font-light leading-none tracking-[-0.04em]"
              style={{ color: 'var(--rf-bone)' }}>
          {num}
        </span>
        {hint && <span className="font-mono-jb text-xl opacity-50" style={{ color: 'var(--rf-sap)' }}>{hint}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {unit && (
          <span className="font-instrument italic text-base" style={{ color: 'var(--rf-sap)' }}>
            {unit}
          </span>
        )}
        <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">
          {label}
        </span>
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
            className="h-8 px-4 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.22em] transition-all"
            style={active
              ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
              : { background: 'rgba(241,234,216,.04)', color: 'var(--rf-bone)', border: '1px solid rgba(241,234,216,.18)' }}>
      {label}
    </button>
  );
}

function SpecimenCard({
  listing, num, distance, pickupTime, quality, category, generatorProfile, isSelected, onSelect, onView,
}: any) {
  return (
    <article id={`listing-card-${listing.id}`}
             onClick={onSelect}
             onMouseEnter={onSelect}
             className="group relative rounded-2xl overflow-hidden border transition-all cursor-pointer hover:-translate-y-1"
             style={{
               borderColor: isSelected ? 'var(--rf-sap)' : 'rgba(241,234,216,.14)',
               background: 'rgba(241,234,216,.025)',
               boxShadow: isSelected ? '0 0 0 1px var(--rf-sap), 0 20px 60px -20px rgba(200,255,77,.3)' : 'none',
             }}>
      {/* Image */}
      <div className="relative h-44 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
             style={{ backgroundImage: `url(${listing.imageUrl})` }} />
        <div className="absolute inset-0"
             style={{ background: 'linear-gradient(to top, rgba(13,26,16,.85), rgba(13,26,16,0) 50%)' }} />

        {/* Specimen number */}
        <div className="absolute top-3 left-3 font-mono-jb text-[10px] uppercase tracking-[0.3em]"
             style={{ color: 'var(--rf-bone)' }}>
          № <span className="font-fraunces fraunces-wonk italic text-2xl ml-1 font-light"
                  style={{ color: 'var(--rf-sap)' }}>{num}</span>
        </div>

        {/* Top right badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <span className="font-mono-jb text-[9px] uppercase tracking-[0.25em] px-2 py-1 rounded"
                style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
            ✓ Verified
          </span>
          {generatorProfile?.averageRating && generatorProfile.averageRating > 0 && (
            <div className="px-2 py-1 rounded backdrop-blur-sm border"
                 style={{ background: 'rgba(13,26,16,.65)', borderColor: 'rgba(241,234,216,.15)' }}>
              <RatingDisplay rating={generatorProfile.averageRating}
                             totalRatings={generatorProfile.totalRatings}
                             size="sm" showCount={false} />
            </div>
          )}
        </div>

        {/* Pickup chip */}
        <div className="absolute bottom-3 left-3 font-mono-jb text-[10px] uppercase tracking-[0.22em] px-2.5 py-1 rounded backdrop-blur-sm border"
             style={{ background: 'rgba(13,26,16,.65)', color: 'var(--rf-bone)', borderColor: 'rgba(241,234,216,.15)' }}>
          ◐ {pickupTime}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-fraunces text-xl font-medium tracking-tight leading-tight transition-colors group-hover:text-[color:var(--rf-sap)]">
              {listing.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-70">
              <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--rf-sap)' }}>near_me</span>
              <span>{distance} km away</span>
            </div>
          </div>
          <span className="shrink-0 font-mono-jb text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded border"
                style={{ borderColor: 'rgba(241,234,216,.18)', color: 'var(--rf-bone)' }}>
            {category}
          </span>
        </div>

        {/* Specs row */}
        <div className="grid grid-cols-3 gap-3 pt-3 mt-1 border-t" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
          <div>
            <p className="font-mono-jb text-[9px] uppercase tracking-[0.25em] opacity-60">Weight</p>
            <p className="font-fraunces text-base font-medium mt-0.5">
              {listing.weightKg ? `${listing.weightKg} kg` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="font-mono-jb text-[9px] uppercase tracking-[0.25em] opacity-60">Quality</p>
            <p className="font-fraunces text-base font-medium mt-0.5">{quality}</p>
          </div>
          <div className="text-right">
            <p className="font-mono-jb text-[9px] uppercase tracking-[0.25em] opacity-60">Price</p>
            <p className="font-fraunces fraunces-wonk text-2xl font-light leading-none mt-0.5"
               style={{ color: 'var(--rf-sap)' }}>
              <span className="font-mono-jb text-[10px] opacity-70 mr-0.5">{listing.currency}</span>
              {listing.price.toFixed(2)}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(); }}
          className="group/btn mt-2 inline-flex items-center justify-between pl-5 pr-1.5 h-11 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
          <span>Claim this parcel</span>
          <span className="flex items-center justify-center size-8 rounded-full transition-transform group-hover/btn:rotate-45"
                style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </article>
  );
}

function EmptyState({ hasFilters, radius, totalListings, onClear }: { hasFilters: boolean; radius: number; totalListings: number; onClear: () => void }) {
  return (
    <div className="text-center py-20 px-6 rounded-2xl border"
         style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.02)' }}>
      <div className="mb-6 font-fraunces fraunces-wonk italic text-7xl font-light leading-none"
           style={{ color: 'var(--rf-sap)' }}>
        ø
      </div>
      <h3 className="font-fraunces text-2xl font-medium mb-3">
        {totalListings === 0 ? 'The benches are bare.' : 'Nothing in your orbit yet.'}
      </h3>
      <p className="font-instrument italic text-lg max-w-md mx-auto mb-8"
         style={{ color: 'rgba(241,234,216,.6)' }}>
        {totalListings === 0
          ? 'The kitchens haven\'t set anything out today. Check back as service winds down.'
          : `Try a wider radius — you\'re currently looking within ${radius}km.`}
      </p>
      {hasFilters && (
        <button onClick={onClear}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em]"
                style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
          Clear all filters →
        </button>
      )}
    </div>
  );
}

function FarmerLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
      <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
        opening today&apos;s almanac<span className="animate-pulse">…</span>
      </p>
    </div>
  );
}
