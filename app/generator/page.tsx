'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, signOut, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceListing, MarketplaceOrder, Rating } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath, getOrdersCollectionPath, getRatingsCollectionPath } from '@/lib/constants';
import FarmerMapView from '@/components/FarmerMapView';
import RatingDisplay from '@/components/RatingDisplay';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import Image from 'next/image';
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
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'analytics' | 'map'>('dashboard');
  const [farmers, setFarmers] = useState<UserProfile[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'reserved' | 'completed' | 'cancelled'>('reserved');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const hasUpcomingPickupWindow = (listing: MarketplaceListing): boolean => {
    if (!listing.pickupWindows || listing.pickupWindows.length === 0) {
      return false;
    }

    const now = new Date();
    return listing.pickupWindows.some((window) => {
      const endTime = new Date(window.end);
      return !Number.isNaN(endTime.getTime()) && endTime > now;
    });
  };

  const shouldAutoExpireListing = (listing: MarketplaceListing): boolean => {
    if (listing.status !== 'live') {
      return false;
    }

    // Keep reserved listings out of auto-expire from this client flow.
    if (listing.reservedBy) {
      return false;
    }

    const hasUpcomingWindow = hasUpcomingPickupWindow(listing);
    const isExpiryElapsed = (() => {
      if (!listing.expiryAt) return false;
      const expiryDate = new Date(listing.expiryAt);
      if (Number.isNaN(expiryDate.getTime())) return false;
      return expiryDate <= new Date();
    })();

    return isExpiryElapsed || !hasUpcomingWindow;
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsubAuth();
  }, [router]);

  // Listings subscription — also auto-expires stale listings on each snapshot.
  useEffect(() => {
    if (!user) return;
    const db = getFirestoreDb();
    const q = query(collection(db, getListingsCollectionPath()), where('generatorUid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const listingsData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceListing[];
        const toExpire = listingsData.filter(shouldAutoExpireListing);
        if (toExpire.length > 0) {
          await Promise.all(
            toExpire.map((l) => updateDoc(doc(db, getListingsCollectionPath(), l.id), { status: 'expired' })),
          );
        }
        const normalized = listingsData.map((l) =>
          toExpire.some((e) => e.id === l.id) ? { ...l, status: 'expired' as const } : l,
        );
        setListings(normalized);
      },
      (err) => {
        console.error(err);
        toast.error('Failed to load listings');
      },
    );
    return () => unsub();
  }, [user]);

  // Farmers subscription — for the "Find Farmers" map tab.
  useEffect(() => {
    if (!user) return;
    const db = getFirestoreDb();
    const q = query(collection(db, 'users'), where('role', '==', 'farmer'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const farmersData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as UserProfile[];
        setFarmers(farmersData.filter((f) => f.location?.latitude && f.location?.longitude));
      },
      (err) => console.error(err),
    );
    return () => unsub();
  }, [user]);

  // Orders subscription — loads ratings sidecar for completed orders.
  useEffect(() => {
    if (!user) return;
    const db = getFirestoreDb();
    const q = query(collection(db, getOrdersCollectionPath()), where('generatorUid', '==', user.uid));
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const ordersData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceOrder[];
        setOrders(ordersData);

        // Sidecar-load ratings for completed orders that have a ratingId.
        const rated = ordersData.filter((o) => o.status === 'completed' && o.ratingId);
        const ratingsMap: Record<string, Rating> = {};
        for (const order of rated) {
          if (!order.ratingId) continue;
          try {
            const r = await getDoc(doc(db, getRatingsCollectionPath(), order.ratingId));
            if (r.exists()) ratingsMap[order.id] = { id: r.id, ...r.data() } as Rating;
          } catch (e) {
            console.error(`Error loading rating for order ${order.id}:`, e);
          }
        }
        setRatings(ratingsMap);
      },
      (err) => {
        console.error(err);
        toast.error('Failed to load orders');
      },
    );
    return () => unsub();
  }, [user]);

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

  // —— Real-data metrics ————————————————————————————————————————————
  // CO2e scaling factor: 1kg food waste avoided from landfill ≈ 2.5 kg CO2e
  // (anaerobic methane + transport + production loss avoided — common figure in food-waste LCA)
  const CO2E_PER_KG = 2.5;

  // —— Memoized derivations. Recompute only when listings/orders change. ——
  // A single map of listingId → MarketplaceListing flips quadratic lookups
  // (orders × listings) into single passes.
  const listingsById = useMemo(() => {
    const m = new Map<string, MarketplaceListing>();
    for (const l of listings) m.set(l.id, l);
    return m;
  }, [listings]);

  const completedListings = useMemo(
    () => listings.filter((l) => l.status === 'completed'),
    [listings],
  );

  const { reservedOrders, completedOrders, cancelledOrders } = useMemo(() => ({
    reservedOrders:  orders.filter((o) => o.status === 'reserved'),
    completedOrders: orders.filter((o) => o.status === 'completed'),
    cancelledOrders: orders.filter((o) => o.status === 'cancelled'),
  }), [orders]);

  // Lifetime totals from REAL listing.weightKg (no fabricated multipliers)
  const wasteDivertedKg = useMemo(
    () => completedListings.reduce((s, l) => s + (l.weightKg || 0), 0),
    [completedListings],
  );
  const carbonReducedTons = (wasteDivertedKg * CO2E_PER_KG) / 1000;

  // Quick stats
  const activeListings = useMemo(() => listings.filter((l) => l.status === 'live').length, [listings]);
  const pendingOrders = reservedOrders.length;
  const totalListings = listings.length;
  const totalEarnings = useMemo(
    () => completedOrders.reduce((sum, o) => sum + o.price, 0),
    [completedOrders],
  );
  const currency = useMemo(() => orders.find((o) => o.currency)?.currency || 'MYR', [orders]);

  // Sell-through rate — meaningful operational KPI: of all listings ever posted,
  // what fraction were successfully collected by a farmer?
  const sellThroughRate = totalListings > 0
    ? (completedListings.length / totalListings) * 100
    : 0;

  // This-week activity (rolling 7 days). Uses the matching order's createdAt as a
  // proxy for the collection date — semantically "diverted this week", not
  // "posted this week and eventually collected".
  const { kgDivertedThisWeek, claimsThisWeek } = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const isWithinWeek = (ts: any) => {
      if (!ts) return false;
      const t = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
      return t >= sevenDaysAgo;
    };
    const kg = completedOrders
      .filter((o) => isWithinWeek(o.createdAt))
      .reduce((sum, o) => sum + (listingsById.get(o.listingId)?.weightKg || 0), 0);
    const claims = orders.filter((o) => isWithinWeek(o.createdAt)).length;
    return { kgDivertedThisWeek: kg, claimsThisWeek: claims };
  }, [completedOrders, orders, listingsById]);

  // Avg time from listing → reservation (hours). Operational health metric.
  const { timesToClaimCount, avgHoursToClaim } = useMemo(() => {
    const samples: number[] = [];
    for (const o of orders) {
      if (o.status !== 'reserved' && o.status !== 'completed') continue;
      const listedAt = listingsById.get(o.listingId)?.createdAt?.toMillis?.();
      const claimedAt = o.createdAt?.toMillis?.();
      if (listedAt && claimedAt && claimedAt >= listedAt) {
        samples.push((claimedAt - listedAt) / (1000 * 60 * 60));
      }
    }
    const avg = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : null;
    return { timesToClaimCount: samples.length, avgHoursToClaim: avg };
  }, [orders, listingsById]);

  // —— Real 6-month series of kg diverted (uses listing.weightKg + listing.createdAt) ——
  type MonthBucket = { key: string; label: string; year: number; month: number; kg: number; count: number };
  const monthlySeries = useMemo<MonthBucket[]>(() => {
    const now = new Date();
    const months: MonthBucket[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        kg: 0,
        count: 0,
      });
    }
    for (const l of completedListings) {
      const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
      const bucket = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
      if (bucket) {
        bucket.kg += l.weightKg || 0;
        bucket.count += 1;
      }
    }
    return months;
  }, [completedListings]);
  const hasMonthlyData = monthlySeries.some((m) => m.kg > 0);
  // Use 1 only as a divisor floor — display layer guards against empty data.
  const monthlyMaxKg = Math.max(1, ...monthlySeries.map((m) => m.kg));

  // —— Real category breakdown by actual kg (full list, sorted) ——
  type CatBucket = { category: string; kg: number; count: number; percentage: number };
  const categoryBreakdown = useMemo<CatBucket[]>(() => {
    const map: Record<string, { kg: number; count: number }> = {};
    for (const l of completedListings) {
      const cat = l.category || 'Other';
      if (!map[cat]) map[cat] = { kg: 0, count: 0 };
      map[cat].kg += l.weightKg || 0;
      map[cat].count += 1;
    }
    const total = Object.values(map).reduce((s, v) => s + v.kg, 0);
    return Object.entries(map)
      .map(([category, v]) => ({
        category,
        kg: v.kg,
        count: v.count,
        percentage: total > 0 ? (v.kg / total) * 100 : 0,
      }))
      .sort((a, b) => b.kg - a.kg);
  }, [completedListings]);

  // —— Top farmer partners — who actually picks up from this kitchen? ——
  type PartnerBucket = { uid: string; orders: number; kg: number; revenue: number };
  const topPartners = useMemo<PartnerBucket[]>(() => {
    const map: Record<string, PartnerBucket> = {};
    for (const o of completedOrders) {
      const uid = o.farmerUid;
      if (!uid) continue;
      if (!map[uid]) map[uid] = { uid, orders: 0, kg: 0, revenue: 0 };
      map[uid].orders += 1;
      map[uid].revenue += o.price || 0;
      const w = listingsById.get(o.listingId)?.weightKg;
      if (w) map[uid].kg += w;
    }
    return Object.values(map).sort((a, b) => b.orders - a.orders).slice(0, 5);
  }, [completedOrders, listingsById]);

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--rf-sap)]/10 text-[var(--rf-sap)] border border-[var(--rf-sap)]/20">
            <span className="size-1.5 rounded-full bg-[var(--rf-sap)]"></span> Live
          </span>
        );
      case 'reserved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[rgba(233,196,106,0.10)] text-[var(--rf-amber)] border border-[rgba(233,196,106,0.25)]">
            <span className="size-1.5 rounded-full bg-[var(--rf-amber)]"></span> Claimed
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[rgba(108,180,241,0.10)] text-[var(--rf-sky)] border border-[rgba(108,180,241,0.25)]">
            <span className="size-1.5 rounded-full bg-[var(--rf-sky)]"></span> Collected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[rgba(241,234,216,0.06)] text-[rgba(241,234,216,0.55)] border border-[rgba(241,234,216,0.15)]">
            <span className="size-1.5 rounded-full bg-[rgba(241,234,216,0.5)]"></span> {status.charAt(0).toUpperCase() + status.slice(1)}
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
    if (categoryLower.includes('fruit') || categoryLower.includes('rind')) return 'nutrition';
    if (categoryLower.includes('leafy') || categoryLower.includes('greens')) return 'local_florist';
    if (categoryLower.includes('bakery') || categoryLower.includes('grain')) return 'bakery_dining';
    if (categoryLower.includes('dairy')) return 'lunch_dining';
    if (categoryLower.includes('meat')) return 'set_meal';
    if (categoryLower.includes('vegetable') || categoryLower.includes('vegetative')) return 'eco';
    if (categoryLower.includes('coffee') || categoryLower.includes('ground')) return 'coffee';
    if (categoryLower.includes('egg')) return 'egg';
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
      <div className="min-h-screen bg-[var(--rf-forest)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--rf-sap)] mx-auto mb-4"></div>
          <p className="text-[var(--rf-bone)]">Loading...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="font-fraunces antialiased overflow-hidden flex flex-col h-screen" style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl border-b" style={{ background: 'rgba(13,26,16,.85)', borderColor: 'rgba(241,234,216,.10)' }}>
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href="/generator" className="flex items-center gap-3 cursor-pointer">
            <div className="relative size-9">
              <Image src="/images/logo.svg" alt="ReFeed logo" fill sizes="36px" priority className="object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <h2 className="font-fraunces fraunces-wonk text-xl font-black tracking-[-0.03em]">
                Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
              </h2>
              <span className="font-mono-jb text-[8px] uppercase tracking-[0.32em] mt-0.5 opacity-60">Kitchen · Ledger</span>
            </div>
          </Link>

          <div className="flex items-center gap-4 ml-auto">
            {userProfile && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 group"
                >
                  <div className="bg-center bg-no-repeat bg-cover rounded-full size-9 ring-2 ring-[var(--rf-moss)] group-hover:ring-[var(--rf-sap)]/50 transition-all shadow-lg bg-gradient-to-br from-[var(--rf-sap)] to-green-400 flex items-center justify-center">
                    <span className="text-[var(--rf-forest)] font-bold text-sm">{userProfile?.name?.charAt(0).toUpperCase() || 'U'}</span>
                  </div>
                  <span className="material-symbols-outlined text-[var(--rf-bone-muted)] text-sm hidden sm:block group-hover:text-[var(--rf-bone)] transition-colors">expand_more</span>
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[var(--rf-card)] rounded-lg shadow-xl border border-[var(--rf-moss)] py-2 z-50">
                    <div className="px-4 py-3 border-b border-[var(--rf-moss)]">
                      <p className="text-sm font-semibold text-[var(--rf-bone)]">{userProfile?.name}</p>
                      <p className="text-xs text-[var(--rf-bone-muted)] mt-1">{userProfile?.contact}</p>
                    </div>
                    <Link href="/settings" className="block px-4 py-2 text-sm font-medium text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] hover:bg-[var(--rf-moss)] transition-colors">
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('orders');
                      }}
                      className="block w-full text-left px-4 py-2 text-sm font-medium text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] hover:bg-[var(--rf-moss)] transition-colors"
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
                      className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--rf-rust)] hover:opacity-90 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-slate-900 dark:text-[var(--rf-bone)]"
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
        <aside className={`w-64 flex-shrink-0 border-r border-[var(--rf-moss)] bg-[var(--rf-ink)] flex flex-col justify-between p-4 transition-transform duration-300 ${sidebarOpen ? 'fixed lg:relative inset-y-0 left-0 z-50' : 'hidden lg:flex'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="flex flex-col gap-6">
            <div className="flex gap-3 items-center px-3 py-4 bg-[var(--rf-card)]/50 rounded-xl border border-[var(--rf-moss)]">
              <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-[var(--rf-moss)] shrink-0 bg-gradient-to-br from-[var(--rf-sap)] to-green-400 flex items-center justify-center">
                <span className="text-[var(--rf-forest)] font-bold text-sm">{userProfile?.name?.charAt(0).toUpperCase() || 'R'}</span>
              </div>
              <div className="flex min-w-0 flex-col">
                <h1 className="text-[var(--rf-bone)] text-sm font-bold leading-tight truncate">{userProfile?.name || 'Restaurant'}</h1>
                <p className="text-[var(--rf-bone-muted)] text-[10px] font-normal uppercase tracking-wide">Restaurant Admin</p>
                {userProfile?.averageRating && userProfile.averageRating > 0 && (
                  <div className="mt-1.5">
                    <RatingDisplay 
                      rating={userProfile.averageRating} 
                      totalRatings={userProfile.totalRatings}
                      showCount={false}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <nav className="flex flex-col gap-1.5">
              <p className="px-3 text-xs font-semibold text-[var(--rf-bone-dim)] uppercase tracking-wider mb-2">Menu</p>

              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'dashboard'
                  ? 'text-[color:var(--rf-sap)] bg-[rgba(200,255,77,0.06)] border border-[rgba(200,255,77,0.25)]'
                  : 'border border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
              >
                <span className={`material-symbols-outlined transition-transform ${activeTab === 'dashboard' ? 'text-[var(--rf-sap)] group-hover:scale-110' : 'group-hover:text-[var(--rf-sap)]'}`}>dashboard</span>
                <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em]"><span className="opacity-50 mr-1.5">01</span>Dashboard</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('inventory');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'inventory'
                  ? 'text-[color:var(--rf-sap)] bg-[rgba(200,255,77,0.06)] border border-[rgba(200,255,77,0.25)]'
                  : 'border border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'inventory' ? 'text-[var(--rf-sap)]' : 'group-hover:text-[var(--rf-sap)]'}`}>recycling</span>
                <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em]"><span className="opacity-50 mr-1.5">02</span>Inventory</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('orders');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'orders'
                  ? 'text-[color:var(--rf-sap)] bg-[rgba(200,255,77,0.06)] border border-[rgba(200,255,77,0.25)]'
                  : 'border border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'orders' ? 'text-[var(--rf-sap)]' : 'group-hover:text-[var(--rf-sap)]'}`}>receipt_long</span>
                <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em]"><span className="opacity-50 mr-1.5">03</span>Orders</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('analytics');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'analytics'
                  ? 'text-[color:var(--rf-sap)] bg-[rgba(200,255,77,0.06)] border border-[rgba(200,255,77,0.25)]'
                  : 'border border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'analytics' ? 'text-[var(--rf-sap)]' : 'group-hover:text-[var(--rf-sap)]'}`}>query_stats</span>
                <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em]"><span className="opacity-50 mr-1.5">04</span>Analytics</p>
              </button>

              <button
                onClick={() => {
                  setActiveTab('map');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${activeTab === 'map'
                  ? 'text-[color:var(--rf-sap)] bg-[rgba(200,255,77,0.06)] border border-[rgba(200,255,77,0.25)]'
                  : 'border border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
              >
                <span className={`material-symbols-outlined transition-colors ${activeTab === 'map' ? 'text-[var(--rf-sap)]' : 'group-hover:text-[var(--rf-sap)]'}`}>map</span>
                <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em]"><span className="opacity-50 mr-1.5">05</span>Field</p>
              </button>
            </nav>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl border" style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="rf-eyebrow" style={{ color: 'var(--rf-bone)', opacity: 0.65 }}>Sell-through</span>
                <span className="font-fraunces fraunces-wonk italic text-2xl font-light leading-none" style={{ color: 'var(--rf-sap)' }}>
                  {sellThroughRate.toFixed(0)}<span className="font-mono-jb text-[10px] ml-0.5 not-italic opacity-70">%</span>
                </span>
              </div>
              <div className="w-full rounded-full h-1 mb-2" style={{ background: 'rgba(241,234,216,.1)' }}>
                <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(100, sellThroughRate)}%`, background: 'var(--rf-sap)' }}></div>
              </div>
              <p className="font-mono-jb text-[9px] uppercase tracking-[0.22em] opacity-50">
                {completedListings.length} of {totalListings} listings collected
              </p>
            </div>

            <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--rf-moss)] text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] transition-colors group">
              <span className="material-symbols-outlined group-hover:text-[var(--rf-sap)] transition-colors">settings</span>
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
              className="flex items-center gap-3 px-3 py-2 text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] transition-colors hover:bg-[var(--rf-moss)] rounded-lg"
            >
              <span className="material-symbols-outlined">logout</span>
              <p className="text-sm font-medium">Log Out</p>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--rf-forest)] relative">
          {/* Search Bar */}
          <div className="flex-none h-16 border-b border-[var(--rf-moss)] px-6 py-3 flex items-center justify-between bg-[var(--rf-forest)]/90 backdrop-blur-sm sticky top-0 z-10">
            <div className="w-full max-w-lg">
              <div className="relative w-full text-[var(--rf-bone-muted)] focus-within:text-[var(--rf-sap)] group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="material-symbols-outlined group-focus-within:text-[var(--rf-sap)] transition-colors">search</span>
                </div>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rf-input block w-full h-10 pl-10 pr-4 text-sm"
                  placeholder="Search the ledger…"
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                  <div className="flex flex-col gap-3">
                    <div className="rf-eyebrow flex items-center gap-3">
                      <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
                      Kitchen · Ledger · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: '2-digit' })}
                    </div>
                    <h2 className="rf-headline text-[clamp(2.5rem,6vw,4.5rem)]">
                      {getGreeting()},
                      <br />
                      <span className="italic">{(userProfile?.name?.split(' ')[0] || 'chef')}.</span>
                    </h2>
                    <p className="font-instrument italic text-xl" style={{ color: 'rgba(241,234,216,.7)' }}>
                      A week of returns, written in the books.
                    </p>
                  </div>
                  <Link
                    href="/generator/listings/new"
                    className="group inline-flex items-center gap-3 pl-6 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                    style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
                  >
                    <span>List surplus</span>
                    <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                          style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </span>
                  </Link>
                </div>

                {/* —— Quick stats · editorial KPI strip —— */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <QuickStat
                    eyebrow="01 · Live"
                    value={activeListings}
                    glyph="✺"
                    flavor={activeListings === 1 ? 'parcel on the bench' : 'parcels on the bench'}
                    accent
                    delay={0}
                  />
                  <QuickStat
                    eyebrow="02 · Claimed"
                    value={pendingOrders}
                    glyph="↻"
                    flavor={pendingOrders === 1 ? 'awaiting collection' : 'awaiting collection'}
                    tone="amber"
                    delay={0.06}
                  />
                  <QuickStat
                    eyebrow="03 · Lifetime"
                    value={totalListings}
                    glyph="◍"
                    flavor={totalListings === 1 ? 'entry on the books' : 'entries on the books'}
                    delay={0.12}
                  />
                  <QuickStat
                    eyebrow="04 · Earned"
                    value={totalEarnings}
                    format="currency"
                    currency={currency}
                    glyph="☖"
                    flavor="from collected parcels"
                    delay={0.18}
                  />
                </div>

                {/* Impact strip — REAL numbers from listing.weightKg + completed listings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* This week kg */}
                  <div className="rounded-2xl p-6 border" style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="rf-eyebrow">Last 7 days · diverted</p>
                      <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-50">kg</span>
                    </div>
                    <p className="font-fraunces fraunces-wonk text-5xl font-light leading-none tracking-[-0.04em] mt-3" style={{ color: 'var(--rf-bone)' }}>
                      {kgDivertedThisWeek.toFixed(0)}
                    </p>
                    <p className="font-instrument italic text-sm mt-2" style={{ color: 'rgba(241,234,216,.55)' }}>
                      from {claimsThisWeek} {claimsThisWeek === 1 ? 'claim' : 'claims'} this week
                    </p>
                  </div>

                  {/* Lifetime kg */}
                  <div className="rounded-2xl p-6 border" style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="rf-eyebrow">All-time · diverted</p>
                      <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-50">kg</span>
                    </div>
                    <p className="font-fraunces fraunces-wonk text-5xl font-light leading-none tracking-[-0.04em] mt-3" style={{ color: 'var(--rf-sap)' }}>
                      {wasteDivertedKg.toFixed(0)}
                    </p>
                    <p className="font-instrument italic text-sm mt-2" style={{ color: 'rgba(241,234,216,.55)' }}>
                      across {completedListings.length} collected {completedListings.length === 1 ? 'parcel' : 'parcels'}
                    </p>
                  </div>

                  {/* Lifetime CO2e */}
                  <div className="rounded-2xl p-6 border" style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="rf-eyebrow">All-time · CO₂e avoided</p>
                      <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-50">tonnes</span>
                    </div>
                    <p className="font-fraunces fraunces-wonk text-5xl font-light leading-none tracking-[-0.04em] mt-3" style={{ color: 'var(--rf-bone)' }}>
                      {carbonReducedTons.toFixed(2)}
                    </p>
                    <p className="font-instrument italic text-sm mt-2" style={{ color: 'rgba(241,234,216,.55)' }}>
                      @ {CO2E_PER_KG} kg CO₂e per kg food waste (LCA estimate)
                    </p>
                  </div>
                </div>

                {/* Six-month bar chart — REAL kg by month from real createdAt */}
                <section className="rounded-2xl p-6 md:p-8 border" style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                  <div className="flex items-baseline justify-between mb-6 pb-4 border-b" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                    <div>
                      <p className="rf-eyebrow mb-1">Last 6 months · kg diverted</p>
                      <h3 className="font-fraunces fraunces-wonk text-2xl font-light tracking-[-0.03em]">
                        Returned to the <span className="italic" style={{ color: 'var(--rf-sap)' }}>soil</span>
                      </h3>
                    </div>
                    <p className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 hidden md:block">
                      {monthlySeries.reduce((s, m) => s + m.count, 0)} parcels · {monthlySeries.reduce((s, m) => s + m.kg, 0).toFixed(0)} kg
                    </p>
                  </div>
                  <div className="grid grid-cols-6 gap-3 h-64 items-end">
                    {monthlySeries.map((m, i) => {
                      const heightPct = (m.kg / monthlyMaxKg) * 100;
                      const isCurrent = i === monthlySeries.length - 1;
                      return (
                        <div key={m.key} className="flex flex-col items-center gap-2 h-full justify-end">
                          <div className="font-mono-jb text-[10px] tracking-tight opacity-70" style={{ color: isCurrent ? 'var(--rf-sap)' : 'var(--rf-bone)' }}>
                            {m.kg > 0 ? m.kg.toFixed(0) : ''}
                          </div>
                          <div className="w-full rounded-t-lg transition-all relative group/bar"
                               style={{
                                 height: `${Math.max(heightPct, m.kg > 0 ? 2 : 0)}%`,
                                 minHeight: m.kg > 0 ? '4px' : '0',
                                 background: isCurrent
                                   ? 'var(--rf-sap)'
                                   : 'rgba(200,255,77,.25)',
                                 border: isCurrent ? 'none' : '1px solid rgba(241,234,216,.10)',
                               }}>
                            {m.kg > 0 && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none">
                                <span className="font-mono-jb text-[9px] uppercase tracking-[0.2em] whitespace-nowrap px-2 py-0.5 rounded"
                                      style={{ background: 'var(--rf-moss)', color: 'var(--rf-bone)' }}>
                                  {m.count} {m.count === 1 ? 'parcel' : 'parcels'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">
                            {m.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {monthlySeries.every((m) => m.kg === 0) && (
                    <p className="text-center font-instrument italic text-base mt-6" style={{ color: 'rgba(241,234,216,.5)' }}>
                      No completed pickups yet — the chart will populate as farmers collect.
                    </p>
                  )}
                </section>

                {/* —— Upcoming pickups —— */}
                {upcomingPickups.length > 0 && (
                  <section className="flex flex-col gap-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="rf-eyebrow mb-2">Chapter 03 · The Day Ahead</p>
                        <h3 className="font-fraunces fraunces-wonk text-3xl md:text-4xl font-light tracking-[-0.03em]">
                          Pickups <span className="italic" style={{ color: 'var(--rf-sap)' }}>scheduled</span>
                        </h3>
                      </div>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="font-mono-jb text-[11px] uppercase tracking-[0.25em] rf-dashed-rule pb-1 opacity-80 hover:opacity-100 hover:text-rf-sap transition-colors"
                      >
                        All orders →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {upcomingPickups.map((order, idx) => {
                        const pickupDate = new Date(order.scheduledWindow.start);
                        const isToday = pickupDate.toDateString() === new Date().toDateString();
                        const isTomorrow = pickupDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                        const num = String(idx + 1).padStart(2, '0');

                        return (
                          <button
                            key={order.id}
                            onClick={() => setActiveTab('orders')}
                            className="group relative rounded-2xl p-5 border text-left w-full transition-all hover:-translate-y-0.5"
                            style={{ borderColor: 'var(--rf-bone-a14)', background: 'rgba(241,234,216,.025)' }}
                          >
                            <div className="flex items-start justify-between mb-4 gap-3">
                              <div className="flex-1 min-w-0">
                                <span className="font-fraunces fraunces-wonk italic text-xl font-light leading-none mb-1.5 block"
                                      style={{ color: 'var(--rf-sap)' }}>
                                  {num}
                                </span>
                                <h4 className="font-fraunces text-lg font-medium tracking-tight leading-tight line-clamp-1"
                                    style={{ color: 'var(--rf-bone)' }}>
                                  {order.title}
                                </h4>
                                <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1">
                                  {order.category}
                                </p>
                              </div>
                              <OrderStatusBadge status="reserved" />
                            </div>

                            <p className="font-instrument italic text-base line-clamp-1 mb-3"
                               style={{ color: 'rgba(241,234,216,.7)' }}>
                              {order.address}
                            </p>

                            <div className="pt-3 border-t flex items-end justify-between gap-3"
                                 style={{ borderColor: 'var(--rf-bone-a08)' }}>
                              <div>
                                <p className="font-instrument italic text-base" style={{ color: 'var(--rf-sap)' }}>
                                  {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickupDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                <p className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60">
                                  {pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </p>
                              </div>
                              <p className="font-fraunces fraunces-wonk text-2xl font-light leading-none"
                                 style={{ color: 'var(--rf-bone)' }}>
                                <span className="font-mono-jb text-[10px] mr-1 opacity-60">{order.currency}</span>
                                {order.price.toFixed(2)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* —— Recent entries — editorial table —— */}
                <section className="flex flex-col gap-5 pb-8">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="rf-eyebrow mb-2">Chapter 02 · The Ledger</p>
                      <h3 className="font-fraunces fraunces-wonk text-3xl md:text-4xl font-light tracking-[-0.03em]">
                        Recent <span className="italic" style={{ color: 'var(--rf-sap)' }}>entries</span>
                      </h3>
                    </div>
                    <button
                      onClick={() => setActiveTab('inventory')}
                      className="font-mono-jb text-[11px] uppercase tracking-[0.25em] rf-dashed-rule pb-1 opacity-80 hover:opacity-100 hover:text-rf-sap transition-colors"
                    >
                      All entries →
                    </button>
                  </div>

                  {recentListings.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden border"
                         style={{ borderColor: 'var(--rf-bone-a14)', background: 'rgba(241,234,216,.025)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--rf-bone-a10)' }}>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">№</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Parcel</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Weight</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Status</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 text-right">Listed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentListings.map((listing, idx) => (
                              <tr key={listing.id} className="group transition-colors hover:bg-white/[0.02]"
                                  style={{ borderBottom: idx === recentListings.length - 1 ? 'none' : '1px solid var(--rf-bone-a08)' }}>
                                <td className="p-4 font-fraunces fraunces-wonk italic text-2xl font-light leading-none"
                                    style={{ color: 'var(--rf-sap)' }}>
                                  {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="p-4">
                                  <Link href={`/generator/listings/${listing.id}`} className="flex items-center gap-3 group/link">
                                    <div className="size-10 rounded-lg flex items-center justify-center shrink-0"
                                         style={{ background: 'var(--rf-sap-a10)' }}>
                                      <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--rf-sap)' }}>
                                        {getCategoryIcon(listing.category)}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-fraunces text-base font-medium leading-tight group-hover/link:text-rf-sap transition-colors">
                                        {listing.title}
                                      </p>
                                      <p className="font-mono-jb text-[9px] uppercase tracking-[0.2em] opacity-50 mt-0.5">
                                        {listing.category}
                                      </p>
                                    </div>
                                  </Link>
                                </td>
                                <td className="p-4 font-fraunces text-base opacity-80">
                                  {listing.weightKg ? `${listing.weightKg} kg` : '—'}
                                </td>
                                <td className="p-4">
                                  {getStatusBadge(listing.status)}
                                </td>
                                <td className="p-4 text-right font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-70">
                                  {formatDate(listing.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyEntry
                      title={
                        searchQuery
                          ? 'Nothing matches.'
                          : listings.length === 0
                            ? 'The ledger is empty.'
                            : 'No recent entries.'
                      }
                      body={
                        searchQuery
                          ? 'Try a different keyword.'
                          : listings.length === 0
                            ? 'Your first parcel begins the loop.'
                            : 'Older entries still live in the Inventory tab.'
                      }
                      showCta={!searchQuery && listings.length === 0}
                    />
                  )}
                </section>
              </>
            ) : activeTab === 'inventory' ? (
              <>
                {/* —— Inventory tab —— */}
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                      <p className="rf-eyebrow mb-2">Chapter 02 · The Ledger</p>
                      <h2 className="rf-headline text-[clamp(2rem,5vw,3.5rem)]">
                        Today&apos;s <span className="italic">surplus,</span> recorded.
                      </h2>
                      <p className="font-instrument italic text-lg mt-2" style={{ color: 'rgba(241,234,216,.65)' }}>
                        Every parcel you&apos;ve set out, in one ledger.
                      </p>
                    </div>
                    <Link
                      href="/generator/listings/new"
                      className="group inline-flex items-center gap-3 pl-6 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                      style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
                    >
                      <span>List surplus</span>
                      <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                            style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                      </span>
                    </Link>
                  </div>

                  {sortedListings.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden border"
                         style={{ borderColor: 'var(--rf-bone-a14)', background: 'rgba(241,234,216,.025)' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--rf-bone-a10)' }}>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">№</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Parcel</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Weight</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Price</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60">Status</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 text-right">Listed</th>
                              <th className="p-4 font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 text-right">·</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedListings.map((listing, idx) => (
                              <tr key={listing.id} className="group transition-colors hover:bg-white/[0.02]"
                                  style={{ borderBottom: idx === sortedListings.length - 1 ? 'none' : '1px solid var(--rf-bone-a08)' }}>
                                <td className="p-4 font-fraunces fraunces-wonk italic text-2xl font-light leading-none"
                                    style={{ color: 'var(--rf-sap)' }}>
                                  {String(idx + 1).padStart(2, '0')}
                                </td>
                                <td className="p-4">
                                  <Link href={`/generator/listings/${listing.id}`} className="flex items-center gap-3 group/link">
                                    <div className="size-10 rounded-lg flex items-center justify-center shrink-0"
                                         style={{ background: 'var(--rf-sap-a10)' }}>
                                      <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--rf-sap)' }}>
                                        {getCategoryIcon(listing.category)}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-fraunces text-base font-medium leading-tight group-hover/link:text-rf-sap transition-colors">
                                        {listing.title}
                                      </p>
                                      <p className="font-mono-jb text-[9px] uppercase tracking-[0.2em] opacity-50 mt-0.5">
                                        {listing.category}
                                      </p>
                                    </div>
                                  </Link>
                                </td>
                                <td className="p-4 font-fraunces text-base opacity-80">
                                  {listing.weightKg ? `${listing.weightKg} kg` : '—'}
                                </td>
                                <td className="p-4">
                                  <p className="font-fraunces fraunces-wonk text-xl font-light leading-none" style={{ color: 'var(--rf-bone)' }}>
                                    <span className="font-mono-jb text-[10px] opacity-60 mr-1">{listing.currency}</span>
                                    {listing.price.toFixed(2)}
                                  </p>
                                </td>
                                <td className="p-4">{getStatusBadge(listing.status)}</td>
                                <td className="p-4 text-right font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-70">
                                  {listing.createdAt ? (() => {
                                    const date = listing.createdAt.toDate ? listing.createdAt.toDate() : new Date(listing.createdAt);
                                    return date.toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                                    });
                                  })() : '—'}
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1 justify-end">
                                    {listing.status === 'live' && (
                                      <>
                                        <Link
                                          href={`/generator/listings/${listing.id}/edit`}
                                          className="size-9 rounded-full flex items-center justify-center border opacity-0 group-hover:opacity-100 transition-all hover:bg-white/5"
                                          style={{ borderColor: 'var(--rf-bone-a18)', color: 'var(--rf-bone)' }}
                                          title="Edit"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">edit</span>
                                        </Link>
                                        <button
                                          onClick={() => deleteListing(listing.id)}
                                          className="size-9 rounded-full flex items-center justify-center border opacity-0 group-hover:opacity-100 transition-all hover:bg-white/5"
                                          style={{ borderColor: 'rgba(217,87,42,0.35)', color: 'var(--rf-rust)' }}
                                          title="Delete"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">delete</span>
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
                    <EmptyEntry
                      title={searchQuery ? 'Nothing matches.' : 'The ledger is empty.'}
                      body={
                        searchQuery
                          ? 'Try a different keyword or clear the search.'
                          : 'Your first parcel begins the loop — a kitchen feeding a field.'
                      }
                      showCta={!searchQuery}
                    />
                  )}
                </div>
              </>
            ) : activeTab === 'orders' ? (
              <>
                {/* —— Orders tab —— */}
                <div className="flex flex-col gap-8">
                  <div>
                    <p className="rf-eyebrow mb-2">Chapter 03 · The Books</p>
                    <h2 className="rf-headline text-[clamp(2rem,5vw,3.5rem)]">
                      Every <span className="italic">handover.</span>
                    </h2>
                    <p className="font-instrument italic text-lg mt-2" style={{ color: 'rgba(241,234,216,.65)' }}>
                      Reserved, collected, cancelled — the day&apos;s exchanges in order.
                    </p>
                  </div>

                  {/* Pill-toggle status filter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderTabPill
                      label="Reserved"
                      count={reservedOrders.length}
                      active={orderStatusFilter === 'reserved'}
                      onClick={() => setOrderStatusFilter('reserved')}
                    />
                    <OrderTabPill
                      label="Collected"
                      count={completedOrders.length}
                      active={orderStatusFilter === 'completed'}
                      onClick={() => setOrderStatusFilter('completed')}
                    />
                    {cancelledOrders.length > 0 && (
                      <OrderTabPill
                        label="Cancelled"
                        count={cancelledOrders.length}
                        active={orderStatusFilter === 'cancelled'}
                        onClick={() => setOrderStatusFilter('cancelled')}
                      />
                    )}
                  </div>

                  {sortedOrders.length > 0 ? (
                    <div className="space-y-4">
                      {sortedOrders.map((order, idx) => {
                        const pickupDate = new Date(order.scheduledWindow.start);
                        const isToday = pickupDate.toDateString() === new Date().toDateString();
                        const isTomorrow = pickupDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                        const num = String(idx + 1).padStart(2, '0');
                        const dim = order.status === 'completed' || order.status === 'cancelled';

                        return (
                          <article
                            key={order.id}
                            className="rounded-2xl p-5 border transition-all hover:-translate-y-0.5"
                            style={{
                              borderColor: 'var(--rf-bone-a14)',
                              background: 'rgba(241,234,216,.025)',
                              opacity: dim ? 0.85 : 1,
                            }}
                          >
                            <div className="flex flex-col md:flex-row gap-5">
                              <div className="relative shrink-0">
                                <img
                                  src={order.imageUrl}
                                  alt={order.title}
                                  className="w-28 h-28 object-cover rounded-xl"
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/112'; }}
                                />
                                <span className="absolute -top-2 -left-2 font-fraunces fraunces-wonk italic text-3xl font-light leading-none px-2"
                                      style={{ color: 'var(--rf-sap)' }}>
                                  {num}
                                </span>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0">
                                    <h3 className="font-fraunces text-xl font-medium tracking-tight leading-tight">{order.title}</h3>
                                    <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1">{order.category}</p>
                                  </div>
                                  <OrderStatusBadge status={order.status} />
                                </div>

                                <p className="font-instrument italic text-base mb-3" style={{ color: 'rgba(241,234,216,.7)' }}>
                                  {order.address}
                                </p>

                                {/* Rating block (collected only) */}
                                {order.status === 'completed' && (
                                  <div className="mb-4 p-3 rounded-xl border"
                                       style={{ borderColor: 'var(--rf-bone-a10)', background: 'rgba(13,26,16,0.4)' }}>
                                    {order.ratingId && ratings[order.id] ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="rf-eyebrow" style={{ color: 'var(--rf-bone)', opacity: 0.65 }}>Field note</span>
                                          <RatingDisplay rating={ratings[order.id].rating} size="sm" showCount={false} />
                                        </div>
                                        {ratings[order.id].comment && (
                                          <p className="font-instrument italic text-base mt-2 pt-2 border-t leading-snug"
                                             style={{ borderColor: 'var(--rf-bone-a08)', color: 'var(--rf-bone)' }}>
                                            &ldquo;{ratings[order.id].comment}&rdquo;
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-65">
                                        <span style={{ color: 'var(--rf-amber)' }}>☆</span>
                                        Awaiting rating
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-end justify-between gap-4 pt-3 border-t"
                                     style={{ borderColor: 'var(--rf-bone-a08)' }}>
                                  <div>
                                    <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-70">
                                      Pickup ·{' '}
                                      {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : pickupDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                      {' · '}
                                      {pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                    </p>
                                    <p className="font-fraunces fraunces-wonk text-3xl font-light leading-none mt-1"
                                       style={{ color: 'var(--rf-sap)' }}>
                                      <span className="font-mono-jb text-xs opacity-70 mr-1" style={{ color: 'var(--rf-bone)' }}>
                                        {order.currency}
                                      </span>
                                      {order.price.toFixed(2)}
                                    </p>
                                  </div>

                                  {order.status === 'reserved' && (
                                    <button
                                      onClick={() => markCompleted(order.id)}
                                      className="group inline-flex items-center gap-3 pl-5 pr-1.5 h-11 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                                      style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
                                    >
                                      <span>Mark collected</span>
                                      <span className="flex items-center justify-center size-8 rounded-full transition-transform group-hover:rotate-45"
                                            style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                                        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyEntry
                      title={
                        orderStatusFilter === 'reserved' ? 'Nothing reserved.'
                        : orderStatusFilter === 'completed' ? 'Nothing collected yet.'
                        : 'No cancellations.'
                      }
                      body={
                        orderStatusFilter === 'reserved'
                          ? 'When a farmer claims a parcel, the entry appears here.'
                          : orderStatusFilter === 'completed'
                            ? 'Pickups you mark collected will land in this column.'
                            : 'Quiet bookkeeping — nothing went sideways.'
                      }
                    />
                  )}
                </div>
              </>
            ) : activeTab === 'analytics' ? (
              <>
                {/* —— Analytics tab · real-data only —— */}
                <div className="flex flex-col gap-10">
                  {/* Header */}
                  <div className="flex flex-col gap-3">
                    <div className="rf-eyebrow">Chapter 04 · The Returns</div>
                    <h2 className="rf-headline text-[clamp(2rem,5vw,3.5rem)]">
                      ESG <span className="italic">analytics</span>
                    </h2>
                    <p className="font-instrument italic text-lg max-w-2xl" style={{ color: 'rgba(241,234,216,.7)' }}>
                      All numbers below are computed from the actual weight, dates, and outcomes recorded in your ledger — no projections, no hypothetical targets.
                    </p>
                  </div>

                  {/* —— 3 KPI cards — all real —— */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KpiCard
                      eyebrow="01 · CO₂e avoided"
                      value={carbonReducedTons.toFixed(2)}
                      unit="t"
                      footnote={`from ${wasteDivertedKg.toFixed(0)} kg diverted · ${CO2E_PER_KG} kg CO₂e per kg (LCA)`}
                      accent
                    />
                    <KpiCard
                      eyebrow="02 · Sell-through"
                      value={sellThroughRate.toFixed(1)}
                      unit="%"
                      footnote={`${completedListings.length} of ${totalListings} listings collected`}
                    />
                    <KpiCard
                      eyebrow="03 · Avg time to claim"
                      value={avgHoursToClaim === null
                        ? '—'
                        : avgHoursToClaim < 1
                          ? `${(avgHoursToClaim * 60).toFixed(0)}`
                          : avgHoursToClaim.toFixed(1)}
                      unit={avgHoursToClaim === null ? '' : avgHoursToClaim < 1 ? 'min' : 'h'}
                      footnote={
                        avgHoursToClaim === null
                          ? 'No claimed pickups yet'
                          : `Across ${timesToClaimCount} ${timesToClaimCount === 1 ? 'claim' : 'claims'}`
                      }
                    />
                  </div>

                  {/* —— Six-month bar chart · kg diverted —— */}
                  <section className="rounded-2xl p-6 md:p-8 border"
                           style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                    <div className="flex items-baseline justify-between mb-6 pb-4 border-b" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                      <div>
                        <p className="rf-eyebrow mb-1">04 · Last 6 months · kg diverted</p>
                        <h3 className="font-fraunces fraunces-wonk text-2xl font-light tracking-[-0.03em]">
                          Monthly <span className="italic" style={{ color: 'var(--rf-sap)' }}>throughput</span>
                        </h3>
                      </div>
                      {hasMonthlyData && (
                        <p className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 hidden md:block">
                          Peak · {monthlyMaxKg.toFixed(0)} kg
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-6 gap-3 h-72 items-end">
                      {monthlySeries.map((m, i) => {
                        const heightPct = (m.kg / monthlyMaxKg) * 100;
                        const isCurrent = i === monthlySeries.length - 1;
                        return (
                          <div key={m.key} className="flex flex-col items-center gap-2 h-full justify-end group">
                            <div className="font-mono-jb text-[10px] tracking-tight transition-opacity"
                                 style={{ color: isCurrent ? 'var(--rf-sap)' : 'var(--rf-bone)', opacity: m.kg > 0 ? 0.85 : 0 }}>
                              {m.kg > 0 ? `${m.kg.toFixed(0)} kg` : ''}
                            </div>
                            <div className="w-full rounded-t-lg transition-all relative"
                                 style={{
                                   height: `${Math.max(heightPct, m.kg > 0 ? 2 : 0)}%`,
                                   minHeight: m.kg > 0 ? '4px' : '0',
                                   background: isCurrent ? 'var(--rf-sap)' : 'rgba(200,255,77,.25)',
                                   border: isCurrent ? 'none' : '1px solid rgba(241,234,216,.10)',
                                 }} />
                            <div className="flex flex-col items-center">
                              <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-70">
                                {m.label}
                              </span>
                              <span className="font-mono-jb text-[9px] opacity-40 mt-0.5">
                                {m.count} {m.count === 1 ? 'pickup' : 'pickups'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {monthlySeries.every((m) => m.kg === 0) && (
                      <p className="text-center font-instrument italic text-base mt-6" style={{ color: 'rgba(241,234,216,.5)' }}>
                        No pickups completed in the last 6 months — the chart will populate as farmers collect.
                      </p>
                    )}
                  </section>

                  {/* —— Category breakdown · real weight + horizontal bars —— */}
                  <section className="rounded-2xl p-6 md:p-8 border"
                           style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                    <div className="flex items-baseline justify-between mb-6 pb-4 border-b" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                      <div>
                        <p className="rf-eyebrow mb-1">05 · By category · actual weight</p>
                        <h3 className="font-fraunces fraunces-wonk text-2xl font-light tracking-[-0.03em]">
                          What&apos;s <span className="italic" style={{ color: 'var(--rf-sap)' }}>returning</span> to the soil
                        </h3>
                      </div>
                      <p className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 hidden md:block">
                        {categoryBreakdown.length} {categoryBreakdown.length === 1 ? 'category' : 'categories'} · {wasteDivertedKg.toFixed(0)} kg total
                      </p>
                    </div>

                    {categoryBreakdown.length === 0 ? (
                      <p className="text-center font-instrument italic text-base py-8" style={{ color: 'rgba(241,234,216,.5)' }}>
                        No category data yet — complete a pickup to see the breakdown.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {categoryBreakdown.map((c, idx) => (
                          <div key={c.category} className="flex items-baseline gap-4">
                            <span className="w-7 font-fraunces fraunces-wonk italic text-2xl font-light leading-none shrink-0"
                                  style={{ color: 'var(--rf-sap)' }}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between mb-1.5 gap-3">
                                <p className="font-fraunces text-base font-medium truncate" style={{ color: 'var(--rf-bone)' }}>
                                  {c.category}
                                </p>
                                <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em] shrink-0">
                                  <span className="opacity-50 mr-2">{c.count} {c.count === 1 ? 'parcel' : 'parcels'}</span>
                                  <span style={{ color: 'var(--rf-sap)' }}>{c.kg.toFixed(0)} kg</span>
                                  <span className="opacity-40 ml-2">· {c.percentage.toFixed(1)}%</span>
                                </p>
                              </div>
                              <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(241,234,216,.08)' }}>
                                <div className="h-1.5 rounded-full transition-all"
                                     style={{ width: `${c.percentage}%`, background: 'var(--rf-sap)' }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* —— Two-column row · partners + export —— */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Top farmer partners */}
                    <section className="lg:col-span-2 rounded-2xl p-6 md:p-8 border"
                             style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                      <div className="flex items-baseline justify-between mb-6 pb-4 border-b" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                        <div>
                          <p className="rf-eyebrow mb-1">06 · Top farmer partners</p>
                          <h3 className="font-fraunces fraunces-wonk text-2xl font-light tracking-[-0.03em]">
                            Who&apos;s closing the <span className="italic" style={{ color: 'var(--rf-sap)' }}>loop</span>
                          </h3>
                        </div>
                        <p className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 hidden md:block">
                          By pickup count
                        </p>
                      </div>

                      {topPartners.length === 0 ? (
                        <p className="text-center font-instrument italic text-base py-8" style={{ color: 'rgba(241,234,216,.5)' }}>
                          No partner data yet — completed pickups will list the farmers here.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {topPartners.map((p, idx) => {
                            const profile = farmers.find((f) => f.id === p.uid);
                            const displayName = profile?.name || `Farmer · ${p.uid.slice(0, 8)}…`;
                            const initial = (profile?.name?.charAt(0) || '?').toUpperCase();
                            return (
                            <div key={p.uid}
                                 className="flex items-center gap-4 p-4 rounded-xl border"
                                 style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(13,26,16,.4)' }}>
                              <span className="font-fraunces fraunces-wonk italic text-3xl font-light leading-none shrink-0"
                                    style={{ color: 'var(--rf-sap)' }}>
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="size-10 rounded-full flex items-center justify-center shrink-0"
                                   style={{ background: 'rgba(200,255,77,.12)', color: 'var(--rf-sap)' }}>
                                <span className="font-fraunces fraunces-wonk italic text-lg leading-none">{initial}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-fraunces text-base font-medium truncate" style={{ color: 'var(--rf-bone)' }}>
                                  {displayName}
                                </p>
                                <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-60 mt-1">
                                  {p.orders} {p.orders === 1 ? 'pickup' : 'pickups'} · {p.kg.toFixed(0)} kg
                                </p>
                              </div>
                              <p className="font-fraunces fraunces-wonk text-2xl font-light leading-none shrink-0"
                                 style={{ color: 'var(--rf-bone)' }}>
                                <span className="font-mono-jb text-xs opacity-60 mr-1">{currency}</span>
                                {p.revenue.toFixed(0)}
                              </p>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {/* Export */}
                    <section className="rounded-2xl p-6 md:p-8 border"
                             style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
                      <p className="rf-eyebrow mb-2">07 · Export</p>
                      <h3 className="font-fraunces fraunces-wonk text-2xl font-light leading-tight tracking-[-0.03em] mb-3">
                        Take the <span className="italic" style={{ color: 'var(--rf-sap)' }}>numbers</span> with you
                      </h3>
                      <p className="font-instrument italic text-base mb-6" style={{ color: 'rgba(241,234,216,.65)' }}>
                        For external reporting, audits, or your own files.
                      </p>
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={() => toast.success('PDF export coming soon')}
                          className="inline-flex items-center justify-between pl-5 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                          style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                          <span>Download PDF</span>
                          <span className="size-9 rounded-full flex items-center justify-center"
                                style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>↓</span>
                        </button>
                        <button
                          onClick={() => toast.success('CSV export coming soon')}
                          className="inline-flex items-center justify-between pl-5 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                          style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
                          <span>Export CSV</span>
                          <span className="size-9 rounded-full flex items-center justify-center border"
                                style={{ borderColor: 'rgba(241,234,216,.2)' }}>↓</span>
                        </button>
                      </div>

                      {/* Footnote with methodology — replaces fake "Pro Tip" */}
                      <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                        <p className="rf-eyebrow mb-2">§ Methodology</p>
                        <p className="font-instrument italic text-sm leading-snug" style={{ color: 'rgba(241,234,216,.55)' }}>
                          CO₂e factor: {CO2E_PER_KG} kg CO₂e per kg food waste — typical LCA estimate for organic waste diverted from landfill (avoided methane + transport + production loss). All other numbers are direct counts and sums from your collected listings.
                        </p>
                      </div>
                    </section>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* —— Find Farmers map tab —— */}
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                      <p className="rf-eyebrow mb-2">Chapter 05 · The Field</p>
                      <h2 className="rf-headline text-[clamp(2rem,5vw,3.5rem)]">
                        The farmers <span className="italic">nearby.</span>
                      </h2>
                      <p className="font-instrument italic text-lg mt-2" style={{ color: 'rgba(241,234,216,.65)' }}>
                        Every pin a kitchen could feed — your network at a glance.
                      </p>
                    </div>
                    {farmers.length > 0 && (
                      <div className="inline-flex items-baseline gap-3 px-5 h-12 rounded-full border"
                           style={{ borderColor: 'var(--rf-bone-a18)', background: 'var(--rf-bone-a04)' }}>
                        <span className="font-fraunces fraunces-wonk italic text-2xl font-light leading-none"
                              style={{ color: 'var(--rf-sap)' }}>
                          {farmers.length}
                        </span>
                        <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-70">
                          {farmers.length === 1 ? 'farmer · in orbit' : 'farmers · in orbit'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Map container */}
                  <div className="relative rounded-2xl overflow-hidden border"
                       style={{ borderColor: 'var(--rf-bone-a14)', height: '600px', minHeight: '600px' }}>
                    <FarmerMapView
                      farmers={farmers}
                      generatorLocation={userProfile?.location}
                      onFarmerSelect={() => {}}
                    />

                    {/* Editorial map legend */}
                    <div className="absolute bottom-4 left-4 rounded-2xl p-4 backdrop-blur-md border z-10"
                         style={{ background: 'rgba(13,26,16,0.75)', borderColor: 'var(--rf-bone-a14)' }}>
                      <p className="rf-eyebrow mb-3">§ Legend</p>
                      <div className="space-y-2">
                        <LegendDot color="var(--rf-rust)" label="You" />
                        <LegendDot color="var(--rf-amber)" label="Farmer" />
                        <LegendDot color="var(--rf-sap)" label="Selected" glow />
                        <LegendDot color="var(--rf-sap)" label="Search radius" ring />
                      </div>
                    </div>
                  </div>

                  {/* Farmer list */}
                  {farmers.length > 0 && (
                    <section className="rounded-2xl p-6 md:p-8 border"
                             style={{ borderColor: 'var(--rf-bone-a14)', background: 'rgba(241,234,216,.025)' }}>
                      <div className="flex items-baseline justify-between mb-6 pb-4 border-b"
                           style={{ borderColor: 'var(--rf-bone-a10)' }}>
                        <div>
                          <p className="rf-eyebrow mb-1">In your orbit</p>
                          <h3 className="font-fraunces fraunces-wonk text-2xl font-light tracking-[-0.03em]">
                            Farmers <span className="italic" style={{ color: 'var(--rf-sap)' }}>available</span>
                          </h3>
                        </div>
                        <span className="font-fraunces fraunces-wonk italic text-3xl font-light leading-none"
                              style={{ color: 'var(--rf-sap)' }}>
                          {farmers.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto">
                        {farmers.map((farmer, idx) => (
                          <div
                            key={farmer.id}
                            className="group rounded-xl p-4 border transition-all hover:-translate-y-0.5 cursor-pointer"
                            style={{ borderColor: 'var(--rf-bone-a10)', background: 'rgba(13,26,16,0.4)' }}
                          >
                            <div className="flex items-start gap-3">
                              <span className="font-fraunces fraunces-wonk italic text-2xl font-light leading-none shrink-0"
                                    style={{ color: 'var(--rf-sap)' }}>
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-fraunces text-base font-medium leading-tight truncate group-hover:text-rf-sap transition-colors">
                                  {farmer.name || 'Farmer'}
                                </h4>
                                {farmer.location?.address && (
                                  <p className="font-instrument italic text-sm truncate mt-0.5" style={{ color: 'rgba(241,234,216,0.65)' }}>
                                    {farmer.location.address}
                                  </p>
                                )}
                                {farmer.searchRadiusKm && (
                                  <p className="font-mono-jb text-[10px] uppercase tracking-[0.22em] opacity-55 mt-1.5">
                                    Orbit · {farmer.searchRadiusKm} km
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {farmers.length === 0 && !loading && (
                    <EmptyEntry
                      title="The field is quiet."
                      body="Farmers will appear here once they register and set their patch of soil."
                    />
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

/* —— Legend dot for the Find Farmers map —— */
function LegendDot({ color, label, glow, ring }: { color: string; label: string; glow?: boolean; ring?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="size-3 rounded-full shrink-0"
        style={{
          background: ring ? 'transparent' : color,
          border: ring ? `2px solid ${color}` : `2px solid var(--rf-bone)`,
          boxShadow: glow ? `0 0 8px ${color}` : 'none',
          opacity: ring ? 0.7 : 1,
        }}
      />
      <span className="font-mono-jb text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--rf-bone)', opacity: 0.8 }}>
        {label}
      </span>
    </div>
  );
}

/* —— Editorial empty state used by Recent / Inventory / Orders tabs —— */
function EmptyEntry({
  title, body, showCta,
}: { title: string; body: string; showCta?: boolean }) {
  return (
    <div className="text-center py-20 rounded-2xl border"
         style={{ borderColor: 'var(--rf-bone-a14)', background: 'rgba(241,234,216,.02)' }}>
      <div className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none mb-4"
           style={{ color: 'var(--rf-sap)' }}>
        ø
      </div>
      <h3 className="font-fraunces text-2xl font-medium mb-2" style={{ color: 'var(--rf-bone)' }}>
        {title}
      </h3>
      <p className="font-instrument italic text-lg max-w-md mx-auto mb-8" style={{ color: 'rgba(241,234,216,.6)' }}>
        {body}
      </p>
      {showCta && (
        <Link
          href="/generator/listings/new"
          className="group inline-flex items-center gap-3 pl-6 pr-2 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
        >
          <span>List surplus</span>
          <span className="flex items-center justify-center size-9 rounded-full transition-transform group-hover:rotate-45"
                style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
        </Link>
      )}
    </div>
  );
}

/* —— Pill-toggle for the Orders status filter —— */
function OrderTabPill({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-5 h-10 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] inline-flex items-center gap-2.5 transition-all"
      style={active
        ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
        : { background: 'var(--rf-bone-a04)', color: 'var(--rf-bone)', border: '1px solid var(--rf-bone-a18)' }}
    >
      <span>{label}</span>
      <span className="font-fraunces fraunces-wonk italic text-lg leading-none"
            style={{ color: active ? 'var(--rf-forest)' : 'var(--rf-sap)' }}>
        {count}
      </span>
    </button>
  );
}

/* —— Status badge for individual order rows —— */
function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; label: string }> = {
    reserved:  { c: 'var(--rf-amber)', bg: 'rgba(233,196,106,.10)', label: 'Reserved'  },
    completed: { c: 'var(--rf-sky)',   bg: 'rgba(108,180,241,.10)', label: 'Collected' },
    cancelled: { c: 'var(--rf-rust)',  bg: 'rgba(217,87,42,.10)',   label: 'Cancelled' },
  };
  const s = map[status] || { c: 'var(--rf-bone)', bg: 'var(--rf-bone-a04)', label: status };
  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.22em]"
      style={{ background: s.bg, color: s.c, border: `1px solid ${s.c}55` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: s.c }} />
      {s.label}
    </span>
  );
}

/* —— Editorial quick-stat tile · used in the dashboard hero strip —— */
function QuickStat({
  eyebrow, value, glyph, flavor, accent, tone, delay, format, currency,
}: {
  eyebrow: string;
  value: number;
  glyph: string;
  flavor: string;
  accent?: boolean;
  tone?: 'amber' | 'sky' | 'rust';
  delay?: number;
  format?: 'currency' | 'plain';
  currency?: string;
}) {
  const accentColor =
    accent ? 'var(--rf-sap)' :
    tone === 'amber' ? 'var(--rf-amber)' :
    tone === 'sky'   ? 'var(--rf-sky)'   :
    tone === 'rust'  ? 'var(--rf-rust)'  :
    'var(--rf-bone)';

  const display = format === 'currency'
    ? value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : String(value);

  return (
    <article
      className="group relative rounded-2xl p-6 border overflow-hidden transition-all hover:-translate-y-0.5 rf-fade-up"
      style={{
        borderColor: 'rgba(241,234,216,.14)',
        background: 'rgba(241,234,216,.025)',
        animationDelay: `${delay ?? 0}s`,
      }}
    >
      {/* Top row · eyebrow + glyph */}
      <div className="flex items-start justify-between mb-6">
        <p className="rf-eyebrow leading-tight">{eyebrow}</p>
        <span
          aria-hidden
          className="font-mono-jb text-xl leading-none transition-opacity opacity-60 group-hover:opacity-100"
          style={{ color: accentColor }}
        >
          {glyph}
        </span>
      </div>

      {/* Numeral — Fraunces wonk display */}
      <p
        className="font-fraunces fraunces-wonk font-light leading-none tracking-[-0.05em]"
        style={{
          color: accentColor,
          fontSize: 'clamp(3rem, 5.5vw, 4.5rem)',
        }}
      >
        {format === 'currency' && (
          <span
            className="font-mono-jb text-xs uppercase tracking-[0.18em] mr-1.5 align-baseline opacity-60"
            style={{ color: 'var(--rf-bone)' }}
          >
            {currency}
          </span>
        )}
        {display}
      </p>

      {/* Flavor · Instrument Serif italic */}
      <p className="font-instrument italic text-sm mt-3 leading-snug"
         style={{ color: 'rgba(241,234,216,.6)' }}>
        {flavor}
      </p>

      {/* Decorative dashed corner — subtle editorial mark */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-3 right-4 font-mono-jb text-[9px] uppercase tracking-[0.32em] opacity-30"
        style={{ color: 'var(--rf-bone)' }}
      >
        §
      </span>
    </article>
  );
}

/* —— Reusable real-data KPI card (no fake trend badges) —— */
function KpiCard({
  eyebrow, value, unit, footnote, accent,
}: { eyebrow: string; value: string; unit?: string; footnote?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-6 border min-h-[10rem] flex flex-col justify-between"
         style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
      <p className="rf-eyebrow">{eyebrow}</p>
      <div>
        <p className="font-fraunces fraunces-wonk font-light leading-none tracking-[-0.04em] mt-3"
           style={{ color: accent ? 'var(--rf-sap)' : 'var(--rf-bone)', fontSize: 'clamp(2.5rem, 4vw, 3.5rem)' }}>
          {value}
          {unit && (
            <span className="font-mono-jb text-base ml-1 align-baseline opacity-70" style={{ color: 'var(--rf-bone)' }}>
              {unit}
            </span>
          )}
        </p>
        {footnote && (
          <p className="font-instrument italic text-sm mt-2 leading-snug" style={{ color: 'rgba(241,234,216,.55)' }}>
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}