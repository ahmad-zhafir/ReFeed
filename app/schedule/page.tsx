'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { MarketplaceOrder, UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import { getOrdersCollectionPath } from '@/lib/constants';
import AuthGuard from '@/components/AuthGuard';
import Link from 'next/link';
import { FarmerHeader } from '@/components/FarmerHeader';
import { GeneratorLayout } from '@/components/GeneratorLayout';

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
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileDropdownOpen(false);
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropdownOpen]);

  useEffect(() => {
    const unsubAuth = onAuthStateChange(async (cu) => {
      if (cu) {
        setUser(cu);
        const profile = await getUserProfile(cu.uid);
        setUserProfile(profile);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!user || !userProfile?.role) return;
    const db = getFirestoreDb();
    const ordersRef = collection(db, getOrdersCollectionPath());
    const q = userProfile.role === 'generator'
      ? query(ordersRef, where('generatorUid', '==', user.uid), where('status', '==', 'reserved'))
      : query(ordersRef, where('farmerUid', '==', user.uid), where('status', '==', 'reserved'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceOrder[];
        data.sort((a, b) => new Date(a.scheduledWindow.start).getTime() - new Date(b.scheduledWindow.start).getTime());
        setOrders(data);
      },
      (err) => console.error(err),
    );
    return () => unsub();
  }, [user, userProfile?.role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          unfolding the calendar<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  const role = userProfile?.role;
  const homePath = role === 'generator' ? '/generator' : '/farmer';

  const groupedOrders = orders.reduce((acc, o) => {
    const date = new Date(o.scheduledWindow.start).toDateString();
    (acc[date] = acc[date] || []).push(o);
    return acc;
  }, {} as Record<string, MarketplaceOrder[]>);

  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear(), month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0);
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
    return days;
  };
  const calendarDays = generateCalendarDays();
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getOrdersForDate = (date: Date) => groupedOrders[date.toDateString()] || [];

  const navigateMonth = (dir: 'prev' | 'next') => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + (dir === 'prev' ? -1 : 1));
    setSelectedDate(d);
  };

  const isGenerator = userProfile?.role === 'generator';

  const content = (
    <main className="relative flex-1 w-full px-4 sm:px-6 lg:px-10 py-10">

        <div className="flex items-center justify-between mb-4 rf-fade-up">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
            Chapter {isGenerator ? '06' : '03'} · The Calendar
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            {orders.length} {orders.length === 1 ? 'pickup' : 'pickups'} pending
          </span>
        </div>

        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-8 rf-fade-up" style={{ animationDelay: '.08s' }}>
          The days <span className="italic">ahead.</span>
        </h1>

        {orders.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border rf-fade-up"
               style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.02)', animationDelay: '.18s' }}>
            <div className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none mb-4"
                 style={{ color: 'var(--rf-sap)' }}>ø</div>
            <h3 className="font-fraunces text-2xl font-medium mb-2">No pickups scheduled.</h3>
            <p className="font-instrument italic text-lg max-w-md mx-auto mb-8" style={{ color: 'rgba(241,234,216,.6)' }}>
              {role === 'generator'
                ? 'When farmers claim your surplus, the dates will appear here.'
                : 'Claim a parcel and the calendar fills.'}
            </p>
            <Link href={homePath}
                  className="inline-flex items-center gap-3 pl-6 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em]"
                  style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
              <span>{role === 'generator' ? 'Post surplus' : 'Browse the gather'}</span>
              <span className="size-9 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>→</span>
            </Link>
          </div>
        ) : (
          <>
            {/* View toggle */}
            <div className="flex justify-end mb-6 rf-fade-up" style={{ animationDelay: '.14s' }}>
              <div className="inline-flex p-1 rounded-full border"
                   style={{ borderColor: 'rgba(241,234,216,.16)', background: 'rgba(241,234,216,.03)' }}>
                <button onClick={() => setViewMode('list')}
                        className="px-5 h-9 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.28em] transition-all"
                        style={viewMode === 'list'
                          ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
                          : { color: 'var(--rf-bone)', opacity: 0.55 }}>
                  Ledger
                </button>
                <button onClick={() => setViewMode('calendar')}
                        className="px-5 h-9 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.28em] transition-all"
                        style={viewMode === 'calendar'
                          ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
                          : { color: 'var(--rf-bone)', opacity: 0.55 }}>
                  Calendar
                </button>
              </div>
            </div>

            {viewMode === 'list' ? (
              <div className="space-y-8 rf-fade-up" style={{ animationDelay: '.2s' }}>
                {Object.entries(groupedOrders).map(([date, dateOrders]) => {
                  const dObj = new Date(date);
                  const isToday    = dObj.toDateString() === new Date().toDateString();
                  const isTomorrow = dObj.toDateString() === new Date(Date.now() + 86400000).toDateString();
                  return (
                    <section key={date} className="rounded-2xl p-6 border"
                             style={{ borderColor: 'rgba(241,234,216,.12)', background: 'rgba(241,234,216,.025)' }}>
                      <div className="flex items-baseline justify-between mb-5 pb-4 border-b"
                           style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                        <div>
                          <p className="rf-eyebrow mb-1">
                            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dObj.toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                          <h3 className="font-fraunces fraunces-wonk text-3xl font-light tracking-[-0.03em]">
                            {dObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            <span className="font-instrument italic ml-2" style={{ color: 'var(--rf-sap)' }}>
                              {dObj.getFullYear()}
                            </span>
                          </h3>
                        </div>
                        <span className="font-fraunces fraunces-wonk italic text-4xl font-light"
                              style={{ color: 'var(--rf-sap)' }}>
                          {dateOrders.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {dateOrders.map((order, i) => (
                          <div key={order.id} className="flex gap-4 p-4 rounded-xl border"
                               style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(13,26,16,.4)' }}>
                            <div className="relative shrink-0">
                              <img src={order.imageUrl} alt={order.title}
                                   className="w-20 h-20 object-cover rounded-lg" />
                              <span className="absolute -top-2 -left-2 font-fraunces fraunces-wonk italic text-xl font-light leading-none px-1.5"
                                    style={{ color: 'var(--rf-sap)' }}>
                                {String(i + 1).padStart(2, '0')}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-fraunces text-lg font-medium leading-tight">{order.title}</h4>
                              <p className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60 mt-1 truncate">
                                {order.address}
                              </p>
                              <div className="flex items-baseline justify-between mt-3 gap-3 flex-wrap">
                                <p className="font-instrument italic text-base" style={{ color: 'var(--rf-bone)' }}>
                                  {new Date(order.scheduledWindow.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                  {' – '}
                                  {new Date(order.scheduledWindow.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </p>
                                <p className="font-fraunces fraunces-wonk text-2xl font-light leading-none"
                                   style={{ color: 'var(--rf-sap)' }}>
                                  <span className="font-mono-jb text-[10px] opacity-70 mr-1" style={{ color: 'var(--rf-bone)' }}>{order.currency}</span>
                                  {order.price.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl p-6 border rf-fade-up"
                   style={{ borderColor: 'rgba(241,234,216,.12)', background: 'rgba(241,234,216,.025)', animationDelay: '.2s' }}>
                {/* Calendar header */}
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => navigateMonth('prev')}
                          className="size-10 rounded-full border flex items-center justify-center hover:bg-white/5 transition-colors"
                          style={{ borderColor: 'rgba(241,234,216,.2)' }}>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <h2 className="font-fraunces fraunces-wonk text-3xl font-light tracking-[-0.03em]">
                    {monthName.split(' ')[0]}{' '}
                    <span className="font-instrument italic" style={{ color: 'var(--rf-sap)' }}>{monthName.split(' ')[1]}</span>
                  </h2>
                  <button onClick={() => navigateMonth('next')}
                          className="size-10 rounded-full border flex items-center justify-center hover:bg-white/5 transition-colors"
                          style={{ borderColor: 'rgba(241,234,216,.2)' }}>
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>

                {/* Day name strip */}
                <div className="grid grid-cols-7 gap-1.5 mb-3">
                  {dayNames.map((d) => (
                    <div key={d} className="font-mono-jb text-[9px] uppercase tracking-[0.25em] opacity-60 text-center py-2">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((day, i) => {
                    if (day === null) return <div key={i} className="aspect-square" />;
                    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                    const dayOrders = getOrdersForDate(d);
                    const isToday = d.toDateString() === new Date().toDateString();
                    const isSelected = d.toDateString() === selectedDate.toDateString();
                    const hasOrders = dayOrders.length > 0;
                    return (
                      <button key={i} onClick={() => setSelectedDate(d)}
                              className="aspect-square p-2 rounded-xl border text-left transition-all hover:-translate-y-0.5 flex flex-col"
                              style={{
                                borderColor: isToday ? 'var(--rf-sap)' : 'rgba(241,234,216,.12)',
                                background: isSelected
                                  ? 'rgba(200,255,77,.12)'
                                  : hasOrders ? 'rgba(241,234,216,.04)' : 'transparent',
                              }}>
                        <div className="flex items-baseline justify-between">
                          <span className="font-fraunces text-base font-medium"
                                style={{ color: isToday ? 'var(--rf-sap)' : 'var(--rf-bone)' }}>
                            {day}
                          </span>
                          {hasOrders && (
                            <span className="font-fraunces fraunces-wonk italic text-sm"
                                  style={{ color: 'var(--rf-sap)' }}>
                              ·{dayOrders.length}
                            </span>
                          )}
                        </div>
                        {hasOrders && (
                          <div className="mt-1 flex-1 overflow-hidden">
                            {dayOrders.slice(0, 1).map((o) => (
                              <p key={o.id}
                                 className="font-mono-jb text-[8px] uppercase tracking-[0.15em] truncate opacity-70">
                                {o.title}
                              </p>
                            ))}
                            {dayOrders.length > 1 && (
                              <p className="font-mono-jb text-[8px] uppercase tracking-[0.15em] opacity-50">
                                +{dayOrders.length - 1}
                              </p>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected day details */}
                {getOrdersForDate(selectedDate).length > 0 && (
                  <div className="mt-8 pt-6 border-t" style={{ borderColor: 'rgba(241,234,216,.10)' }}>
                    <div className="rf-eyebrow mb-3">
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="space-y-3">
                      {getOrdersForDate(selectedDate).map((order) => (
                        <div key={order.id} className="flex gap-4 p-4 rounded-xl border"
                             style={{ borderColor: 'rgba(241,234,216,.10)', background: 'rgba(13,26,16,.4)' }}>
                          <img src={order.imageUrl} alt={order.title} className="w-16 h-16 object-cover rounded-lg" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-fraunces text-lg font-medium leading-tight">{order.title}</h4>
                            <p className="font-mono-jb text-[10px] uppercase tracking-[0.2em] opacity-60 mt-1 truncate">
                              {order.address}
                            </p>
                            <div className="flex items-baseline justify-between mt-2 gap-3 flex-wrap">
                              <p className="font-instrument italic text-sm" style={{ color: 'var(--rf-bone)' }}>
                                {new Date(order.scheduledWindow.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {' – '}
                                {new Date(order.scheduledWindow.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </p>
                              <p className="font-fraunces fraunces-wonk text-xl font-light leading-none"
                                 style={{ color: 'var(--rf-sap)' }}>
                                <span className="font-mono-jb text-[10px] opacity-70 mr-1" style={{ color: 'var(--rf-bone)' }}>{order.currency}</span>
                                {order.price.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
  );

  if (isGenerator) {
    return (
      <GeneratorLayout user={user} userProfile={userProfile} active="schedule" router={router}>
        {content}
      </GeneratorLayout>
    );
  }

  return (
    <div className="font-fraunces antialiased min-h-screen flex flex-col relative"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
      <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />
      <FarmerHeader userProfile={userProfile} active="pickups"
        profileDropdownOpen={profileDropdownOpen} setProfileDropdownOpen={setProfileDropdownOpen}
        dropdownRef={dropdownRef} router={router} />
      {content}
    </div>
  );
}
