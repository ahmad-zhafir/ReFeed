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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState(new Date());

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
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="mb-6">
              <span className="material-symbols-outlined text-gray-300 text-6xl mb-4 inline-block">event_busy</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No scheduled pickups yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {role === 'generator' 
                ? 'Once farmers reserve your listings, they will appear here.'
                : 'Reserve a listing to see it scheduled here.'}
            </p>
            <Link
              href={homePath}
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
            >
              {role === 'generator' ? 'Post a Listing' : 'Browse Listings'}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between bg-white rounded-xl shadow-md p-4 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>
              <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  List View
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Calendar View
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="space-y-6">
                {Object.entries(groupedOrders).map(([date, dateOrders]) => (
                  <div key={date} className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{date}</h2>
                    <div className="space-y-4">
                      {dateOrders.map((order) => (
                        <div key={order.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <img src={order.imageUrl} alt={order.title} className="w-20 h-20 object-cover rounded-lg" />
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900">{order.title}</h3>
                            <p className="text-sm text-gray-600">{order.address}</p>
                            <p className="text-sm font-semibold text-emerald-600 mt-1">
                              {order.currency} {order.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
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
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">{monthName}</h2>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-700 py-2">
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
                        className={`aspect-square p-2 border rounded-lg transition-colors ${
                          isToday
                            ? 'bg-emerald-50 border-emerald-500'
                            : dayOrders.length > 0
                            ? 'bg-green-50 border-green-300 hover:bg-green-100'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${isToday ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {day}
                          {isToday && <span className="ml-1 text-xs">Today</span>}
                        </div>
                        {dayOrders.length > 0 && (
                          <div className="space-y-1">
                            {dayOrders.slice(0, 2).map((order) => (
                              <div
                                key={order.id}
                                className="text-xs bg-white px-1 py-0.5 rounded truncate border border-green-200"
                                title={order.title}
                              >
                                {order.title}
                              </div>
                            ))}
                            {dayOrders.length > 2 && (
                              <div className="text-xs text-gray-600 font-medium">
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
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                    <div className="space-y-3">
                      {getOrdersForDate(selectedDate).map((order) => (
                        <div key={order.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                          <img src={order.imageUrl} alt={order.title} className="w-16 h-16 object-cover rounded-lg" />
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{order.title}</h4>
                            <p className="text-sm text-gray-600">{order.address}</p>
                            <p className="text-sm font-semibold text-emerald-600 mt-1">
                              {order.currency} {order.price.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
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
      </div>
    </div>
  );
}

