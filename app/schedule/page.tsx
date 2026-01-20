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
import Link from 'next/link';
import toast from 'react-hot-toast';

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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
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

  // Group orders by date
  const groupedOrders = orders.reduce((acc, order) => {
    const date = new Date(order.scheduledWindow.start).toDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(order);
    return acc;
  }, {} as Record<string, MarketplaceOrder[]>);

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: (number | null)[] = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getOrdersForDate = (date: Date): MarketplaceOrder[] => {
    const dateStr = date.toDateString();
    return groupedOrders[dateStr] || [];
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

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
                <Link href="/schedule" className="text-white font-medium text-sm border-b-2 border-[#13ec37] transition-colors">
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
                        {userProfile.email && (
                          <p className="text-xs text-[#92c99b] mt-1">{userProfile.email}</p>
                        )}
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
        {orders.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1c2e20] rounded-xl border border-gray-200 dark:border-[#234829]">
            <div className="mb-6">
              <span className="material-symbols-outlined text-gray-300 dark:text-[#5d8265] text-6xl mb-4 inline-block">event_busy</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No scheduled pickups yet</h3>
            <p className="text-gray-600 dark:text-[#92c99b] mb-6 max-w-md mx-auto">
              {role === 'generator' 
                ? 'Once farmers reserve your listings, they will appear here.'
                : 'Reserve a listing to see it scheduled here.'}
            </p>
            <Link
              href={homePath}
              className="inline-block px-6 py-3 bg-[#13ec37] hover:bg-[#11d832] text-[#112214] rounded-lg transition-colors font-bold"
            >
              {role === 'generator' ? 'Post a Listing' : 'Browse Listings'}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between bg-white dark:bg-[#1c2e20] rounded-xl shadow-md p-4 border border-gray-200 dark:border-[#234829]">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Schedule</h2>
              <div className="flex gap-2 bg-gray-100 dark:bg-[#112214] rounded-lg p-1 border border-gray-200 dark:border-[#234829]">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-[#234829] text-slate-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-[#92c99b] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white dark:bg-[#234829] text-slate-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-[#92c99b] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Calendar View
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="space-y-6">
                {Object.entries(groupedOrders).map(([date, dateOrders]) => (
                  <div key={date} className="bg-white dark:bg-[#1c2e20] rounded-xl shadow-md p-6 border border-gray-200 dark:border-[#234829]">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{date}</h2>
                    <div className="space-y-4">
                      {dateOrders.map((order) => (
                        <div key={order.id} className="flex gap-4 p-4 bg-gray-50 dark:bg-[#112214] rounded-lg hover:bg-gray-100 dark:hover:bg-[#234829] transition-colors border border-gray-200 dark:border-[#234829]">
                          <img src={order.imageUrl} alt={order.title} className="w-20 h-20 object-cover rounded-lg" />
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white">{order.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-[#92c99b]">{order.address}</p>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-[#13ec37] mt-1">
                              {order.currency} {order.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-[#92c99b] mt-1">
                              {new Date(order.scheduledWindow.start).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true
                              })} - {new Date(order.scheduledWindow.end).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#1c2e20] rounded-xl shadow-md p-6 border border-gray-200 dark:border-[#234829]">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#234829] rounded-lg transition-colors text-gray-700 dark:text-white"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{monthName}</h2>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#234829] rounded-lg transition-colors text-gray-700 dark:text-white"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-700 dark:text-[#92c99b] py-2">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, index) => {
                    if (day === null) {
                      return <div key={index} className="aspect-square"></div>;
                    }
                    const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                    const dayOrders = getOrdersForDate(currentDate);
                    const isToday = currentDate.toDateString() === new Date().toDateString();
                    
                      return (
                        <div
                          key={index}
                          className={`aspect-square p-2 border rounded-lg transition-colors cursor-pointer ${
                            isToday
                              ? 'bg-emerald-50 dark:bg-[#13ec37]/20 border-emerald-500 dark:border-[#13ec37]'
                              : dayOrders.length > 0
                              ? 'bg-green-50 dark:bg-[#234829] border-green-300 dark:border-[#32673b] hover:bg-green-100 dark:hover:bg-[#32673b]'
                              : 'border-gray-200 dark:border-[#234829] hover:bg-gray-50 dark:hover:bg-[#112214]'
                          }`}
                          onClick={() => {
                            const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                            setSelectedDate(date);
                          }}
                        >
                          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-emerald-700 dark:text-[#13ec37]' : 'text-slate-900 dark:text-white'}`}>
                            {day}
                            {isToday && <span className="ml-1 text-xs">Today</span>}
                          </div>
                          {dayOrders.length > 0 && (
                            <div className="space-y-1">
                              {dayOrders.slice(0, 2).map((order) => (
                                <div
                                  key={order.id}
                                  className="text-xs bg-white dark:bg-[#1c2e20] px-1 py-0.5 rounded truncate border border-green-200 dark:border-[#32673b] text-gray-900 dark:text-white"
                                  title={order.title}
                                >
                                  {order.title}
                                </div>
                              ))}
                              {dayOrders.length > 2 && (
                                <div className="text-xs text-gray-600 dark:text-[#92c99b] font-medium">
                                  +{dayOrders.length - 2} more
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                  })}
                </div>

                {/* Selected Date Details */}
                {getOrdersForDate(selectedDate).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#234829]">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                    <div className="space-y-3">
                      {getOrdersForDate(selectedDate).map((order) => (
                        <div key={order.id} className="flex gap-4 p-4 bg-gray-50 dark:bg-[#112214] rounded-lg border border-gray-200 dark:border-[#234829]">
                          <img src={order.imageUrl} alt={order.title} className="w-16 h-16 object-cover rounded-lg" />
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">{order.title}</h4>
                            <p className="text-sm text-gray-600 dark:text-[#92c99b]">{order.address}</p>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-[#13ec37] mt-1">
                              {order.currency} {order.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-[#92c99b] mt-1">
                              {new Date(order.scheduledWindow.start).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true
                              })} - {new Date(order.scheduledWindow.end).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

