'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getFirestoreDb, signOut } from '@/lib/firebase';
import { getListingsCollectionPath } from '@/lib/constants';
import { MarketplaceListing, UserProfile } from '@/lib/types';
import { GeneratorSidebar, GeneratorSidebarKey } from './GeneratorSidebar';
import toast from 'react-hot-toast';

export function GeneratorLayout({
  user,
  userProfile,
  active,
  router,
  children,
}: {
  user: User | null;
  userProfile: UserProfile | null;
  active: GeneratorSidebarKey;
  router: any;
  children: React.ReactNode;
}) {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileDropdownOpen]);

  useEffect(() => {
    if (!user) return;
    const db = getFirestoreDb();
    const q = query(collection(db, getListingsCollectionPath()), where('generatorUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MarketplaceListing[]);
    });
    return () => unsub();
  }, [user]);

  const { totalListings, completedCount, sellThroughRate } = useMemo(() => {
    const completed = listings.filter((l) => l.status === 'completed').length;
    const total = listings.length;
    return {
      totalListings: total,
      completedCount: completed,
      sellThroughRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [listings]);

  return (
    <div
      className="font-fraunces antialiased overflow-hidden flex flex-col h-screen"
      style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}
    >
      {/* Top Header */}
      <header
        className="sticky top-0 z-50 w-full backdrop-blur-xl border-b"
        style={{ background: 'rgba(13,26,16,.85)', borderColor: 'rgba(241,234,216,.10)' }}
      >
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href="/generator" className="flex items-center gap-3 cursor-pointer">
            <div className="relative size-9">
              <Image src="/images/logo.svg" alt="ReFeed logo" fill sizes="36px" priority className="object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <h2 className="font-fraunces fraunces-wonk text-xl font-black tracking-[-0.03em]">
                Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
              </h2>
              <span className="font-mono-jb text-[8px] uppercase tracking-[0.32em] mt-0.5 opacity-60">
                Kitchen · Ledger
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 ml-auto">
            {userProfile && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 group"
                >
                  <div className="rounded-full size-9 ring-2 ring-[var(--rf-moss)] group-hover:ring-[var(--rf-sap)]/50 transition-all shadow-lg bg-gradient-to-br from-[var(--rf-sap)] to-green-400 flex items-center justify-center">
                    <span className="text-[var(--rf-forest)] font-bold text-sm">
                      {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-[var(--rf-bone-muted)] text-sm hidden sm:block group-hover:text-[var(--rf-bone)] transition-colors">
                    expand_more
                  </span>
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[var(--rf-card)] rounded-lg shadow-xl border border-[var(--rf-moss)] py-2 z-50">
                    <div className="px-4 py-3 border-b border-[var(--rf-moss)]">
                      <p className="text-sm font-semibold text-[var(--rf-bone)]">{userProfile?.name}</p>
                      <p className="text-xs text-[var(--rf-bone-muted)] mt-1">{userProfile?.contact}</p>
                    </div>
                    <Link
                      href="/settings"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-4 py-2 text-sm font-medium text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] hover:bg-[var(--rf-moss)] transition-colors"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-4 py-2 text-sm font-medium text-[var(--rf-bone-muted)] hover:text-[var(--rf-bone)] hover:bg-[var(--rf-moss)] transition-colors"
                    >
                      Orders
                    </Link>
                    <button
                      onClick={async () => {
                        try {
                          setProfileDropdownOpen(false);
                          await signOut();
                          await new Promise((r) => setTimeout(r, 100));
                          router.push('/');
                        } catch {
                          toast.error('Failed to sign out. Please try again.');
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--rf-rust)] hover:opacity-90 hover:bg-white/5 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <GeneratorSidebar
          userProfile={userProfile}
          active={active}
          router={router}
          sellThroughRate={sellThroughRate}
          completedCount={completedCount}
          totalListings={totalListings}
        />

        <main className="flex-1 overflow-y-auto relative">
          <div className="pointer-events-none fixed inset-0 rf-dotgrid opacity-40" />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
