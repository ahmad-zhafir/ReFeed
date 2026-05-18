'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import toast from 'react-hot-toast';

export type FarmerNavKey = 'marketplace' | 'map' | 'pickups' | 'orders';

export function FarmerHeader({
  userProfile,
  active,
  profileDropdownOpen,
  setProfileDropdownOpen,
  dropdownRef,
  router,
  extra,
}: {
  userProfile: UserProfile | null;
  active: FarmerNavKey;
  profileDropdownOpen: boolean;
  setProfileDropdownOpen: (v: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  router: any;
  extra?: React.ReactNode;
}) {
  const navItem = (label: string, href: string, key: FarmerNavKey, num: string) => (
    <Link
      href={href}
      className={`font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-colors ${
        active === key ? 'text-[color:var(--rf-sap)]' : 'opacity-70 hover:opacity-100'
      }`}
    >
      <span className="opacity-50 mr-1.5">{num}</span>
      {label}
    </Link>
  );

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-xl border-b"
      style={{ background: 'rgba(13,26,16,.85)', borderColor: 'rgba(241,234,216,.10)' }}
    >
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/farmer" className="flex items-center gap-3">
            <div className="relative size-8">
              <Image src="/images/logo.svg" alt="ReFeed logo" fill sizes="32px" priority className="object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <h2 className="font-fraunces fraunces-wonk text-lg font-black tracking-[-0.03em]">
                Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
              </h2>
              <span className="font-mono-jb text-[8px] uppercase tracking-[0.32em] mt-0.5 opacity-60 hidden sm:block">
                Forager · Almanac
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {navItem('Marketplace', '/farmer', 'marketplace', '01')}
            {navItem('Map', '/farmer/map', 'map', '02')}
            {navItem('Pickups', '/schedule', 'pickups', '03')}
            {navItem('Orders', '/orders', 'orders', '04')}
          </nav>

          <div className="flex items-center gap-3">
            {extra}
            {userProfile && (
              <div className="relative" ref={dropdownRef}>
                <button onClick={() => setProfileDropdownOpen(!profileDropdownOpen)} className="flex items-center gap-2 group">
                  <div
                    className="rounded-full size-9 flex items-center justify-center border transition-all"
                    style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)', borderColor: 'rgba(241,234,216,.2)' }}
                  >
                    <span className="font-fraunces fraunces-wonk italic font-medium text-lg leading-none">
                      {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-sm opacity-60 group-hover:opacity-100">expand_more</span>
                </button>
                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-3 w-64 rounded-2xl shadow-2xl py-2 z-50 border"
                    style={{ background: 'var(--rf-moss)', borderColor: 'rgba(241,234,216,.12)' }}
                  >
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(241,234,216,.1)' }}>
                      <p className="font-fraunces text-base font-semibold">{userProfile.name}</p>
                      <p className="font-mono-jb text-[10px] uppercase tracking-wider opacity-60 mt-1">{userProfile.contact}</p>
                    </div>
                    {[
                      { href: '/settings', label: 'Settings' },
                      { href: '/orders', label: 'My Orders' },
                      { href: '/schedule', label: 'Schedule' },
                    ].map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => setProfileDropdownOpen(false)}
                        className="block px-4 py-2.5 font-mono-jb text-[11px] uppercase tracking-[0.22em] opacity-80 hover:opacity-100 hover:text-[color:var(--rf-sap)] transition-colors"
                      >
                        → {it.label}
                      </Link>
                    ))}
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
                      className="w-full text-left px-4 py-2.5 font-mono-jb text-[11px] uppercase tracking-[0.22em] transition-colors hover:opacity-100 opacity-80"
                      style={{ color: 'var(--rf-rust)' }}
                    >
                      → Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
