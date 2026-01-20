'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getListingsCollectionPath } from '@/lib/constants';
import RoleGuard from '@/components/RoleGuard';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function GeneratorListingsPage() {
  return (
    <RoleGuard allowedRoles={['generator']}>
      <GeneratorListingsContent />
    </RoleGuard>
  );
}

function GeneratorListingsContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        
        if (profile) {
          await loadListings(currentUser.uid);
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
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
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

  const filteredListings = listings.filter((listing) => {
    if (!searchQuery) return true;
    const queryLower = searchQuery.toLowerCase();
    return (
      listing.title.toLowerCase().includes(queryLower) ||
      listing.category.toLowerCase().includes(queryLower) ||
      listing.address.toLowerCase().includes(queryLower)
    );
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

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
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen">
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

          <Link
            href="/generator/listings/new"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg shadow-[0_0_20px_rgba(19,236,55,0.3)] transition-all font-bold text-sm"
          >
            <span className="material-symbols-outlined">add</span>
            New Listing
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col gap-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Waste Inventory</h1>
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

          {/* Search */}
          <div className="w-full max-w-md">
            <div className="relative w-full text-[#92c99b] focus-within:text-[#13ec37] group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="material-symbols-outlined group-focus-within:text-[#13ec37] transition-colors">search</span>
              </div>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full py-2 pl-10 pr-4 text-sm text-white bg-[#1c2e20] border border-[#234829] rounded-lg focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] placeholder-[#92c99b]/50 transition-all hover:bg-[#234829]"
                placeholder="Search listings..."
                type="text"
              />
            </div>
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
                {searchQuery ? 'No listings match your search.' : 'No listings yet. Start by posting your first waste listing!'}
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
      </main>
    </div>
  );
}

