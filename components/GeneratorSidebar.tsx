'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signOut } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import toast from 'react-hot-toast';
import RatingDisplay from './RatingDisplay';

export type GeneratorSidebarKey =
  | 'dashboard'
  | 'inventory'
  | 'orders'
  | 'analytics'
  | 'map'
  | 'schedule';

type Item = {
  key: GeneratorSidebarKey;
  label: string;
  number: string;
  icon: string;
  href: string;
};

const ITEMS: Item[] = [
  { key: 'dashboard', label: 'Dashboard', number: '01', icon: 'dashboard', href: '/generator' },
  { key: 'inventory', label: 'Inventory', number: '02', icon: 'recycling', href: '/generator?tab=inventory' },
  { key: 'orders', label: 'Orders', number: '03', icon: 'receipt_long', href: '/orders' },
  { key: 'analytics', label: 'Analytics', number: '04', icon: 'query_stats', href: '/generator?tab=analytics' },
  { key: 'map', label: 'Field', number: '05', icon: 'map', href: '/generator?tab=map' },
  { key: 'schedule', label: 'Schedule', number: '06', icon: 'calendar_month', href: '/schedule' },
];

export function GeneratorSidebar({
  userProfile,
  active,
  router,
  sellThroughRate,
  completedCount,
  totalListings,
}: {
  userProfile: UserProfile | null;
  active: GeneratorSidebarKey;
  router: any;
  sellThroughRate?: number;
  completedCount?: number;
  totalListings?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`w-64 flex-shrink-0 border-r border-[var(--rf-moss)] bg-[var(--rf-ink)] flex flex-col justify-between p-4 transition-transform duration-300 ${
          open ? 'fixed lg:relative inset-y-0 left-0 z-50' : 'hidden lg:flex'
        } ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col gap-6">
          <div className="flex gap-3 items-center px-3 py-4 bg-[var(--rf-card)]/50 rounded-xl border border-[var(--rf-moss)]">
            <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-[var(--rf-moss)] shrink-0 bg-gradient-to-br from-[var(--rf-sap)] to-green-400 flex items-center justify-center">
              <span className="text-[var(--rf-forest)] font-bold text-sm">
                {userProfile?.name?.charAt(0).toUpperCase() || 'R'}
              </span>
            </div>
            <div className="flex min-w-0 flex-col">
              <h1 className="text-[var(--rf-bone)] text-sm font-bold leading-tight truncate">
                {userProfile?.name || 'Restaurant'}
              </h1>
              <p className="text-[var(--rf-bone-muted)] text-[10px] font-normal uppercase tracking-wide">
                Restaurant Admin
              </p>
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
            <p className="px-3 text-xs font-semibold text-[var(--rf-bone-dim)] uppercase tracking-wider mb-2">
              Menu
            </p>

            {ITEMS.map((it) => {
              const isActive = active === it.key;
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                    isActive
                      ? 'text-[color:var(--rf-sap)] bg-[rgba(200,255,77,0.06)] border border-[rgba(200,255,77,0.25)]'
                      : 'border border-transparent hover:bg-white/5 opacity-70 hover:opacity-100'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined transition-colors ${
                      isActive ? 'text-[var(--rf-sap)]' : 'group-hover:text-[var(--rf-sap)]'
                    }`}
                  >
                    {it.icon}
                  </span>
                  <p className="font-mono-jb text-[11px] uppercase tracking-[0.22em]">
                    <span className="opacity-50 mr-1.5">{it.number}</span>
                    {it.label}
                  </p>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-4">
          {typeof sellThroughRate === 'number' && (
            <div
              className="p-4 rounded-2xl border"
              style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}
            >
              <div className="flex items-baseline justify-between mb-2">
                <span className="rf-eyebrow" style={{ color: 'var(--rf-bone)', opacity: 0.65 }}>
                  Sell-through
                </span>
                <span
                  className="font-fraunces fraunces-wonk italic text-2xl font-light leading-none"
                  style={{ color: 'var(--rf-sap)' }}
                >
                  {sellThroughRate.toFixed(0)}
                  <span className="font-mono-jb text-[10px] ml-0.5 not-italic opacity-70">%</span>
                </span>
              </div>
              <div className="w-full rounded-full h-1 mb-2" style={{ background: 'rgba(241,234,216,.1)' }}>
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${Math.min(100, sellThroughRate)}%`, background: 'var(--rf-sap)' }}
                />
              </div>
              <p className="font-mono-jb text-[9px] uppercase tracking-[0.22em] opacity-50">
                {completedCount ?? 0} of {totalListings ?? 0} listings collected
              </p>
            </div>
          )}

          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--rf-moss)] text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] transition-colors group"
          >
            <span className="material-symbols-outlined group-hover:text-[var(--rf-sap)] transition-colors">
              settings
            </span>
            <p className="text-sm font-medium">Settings</p>
          </Link>

          <button
            onClick={async () => {
              try {
                await signOut();
                await new Promise((r) => setTimeout(r, 100));
                router.push('/');
              } catch {
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

      {/* Mobile toggle button — pinned bottom-left so it doesn't collide with the top header */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-4 left-4 z-30 size-12 rounded-full border bg-[var(--rf-ink)] flex items-center justify-center shadow-lg"
        style={{ borderColor: 'rgba(241,234,216,.2)' }}
        aria-label="Open menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
    </>
  );
}
