'use client';

import React from 'react';
import Link from 'next/link';
import { signOut } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';
import toast from 'react-hot-toast';
import { FarmerHeader } from './FarmerHeader';

export type GeneratorNavKey = 'dashboard' | 'inventory' | 'orders' | 'schedule' | 'settings';

export function GeneratorHeader({
  userProfile,
  active,
  profileDropdownOpen,
  setProfileDropdownOpen,
  dropdownRef,
  router,
  extra,
}: {
  userProfile: UserProfile | null;
  active: GeneratorNavKey;
  profileDropdownOpen: boolean;
  setProfileDropdownOpen: (v: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  router: any;
  extra?: React.ReactNode;
}) {
  const navItem = (label: string, href: string, key: GeneratorNavKey, num: string) => (
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
          <Link href="/generator" className="flex items-center gap-3">
            <div className="relative size-8">
              <div className="absolute inset-0 rounded-full border border-dashed" style={{ borderColor: 'var(--rf-sap)' }} />
              <div
                className="absolute inset-1 rounded-full flex items-center justify-center"
                style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
              >
                <svg viewBox="0 0 48 48" className="size-3.5" fill="currentColor">
                  <path d="M42.4 44s-6.4-10.1-1.3-20C46.9 12.9 42.2 4 42.2 4H7s4.7 8.9-1 20C.9 33.9 7.3 44 7.3 44h35.1z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <h2 className="font-fraunces fraunces-wonk text-lg font-black tracking-[-0.03em]">
                Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
              </h2>
              <span className="font-mono-jb text-[8px] uppercase tracking-[0.32em] mt-0.5 opacity-60 hidden sm:block">
                Kitchen · Ledger
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {navItem('Dashboard', '/generator', 'dashboard', '01')}
            {navItem('Inventory', '/generator/listings', 'inventory', '02')}
            {navItem('Orders', '/orders', 'orders', '03')}
            {navItem('Schedule', '/schedule', 'schedule', '04')}
          </nav>

          <div className="flex items-center gap-3">
            {extra ?? (
              <Link
                href="/generator/listings/new"
                className="hidden sm:inline-flex items-center gap-2 pl-5 pr-1.5 h-9 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
              >
                <span>List surplus</span>
                <span
                  className="size-7 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}
                >
                  +
                </span>
              </Link>
            )}
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
                      { href: '/orders', label: 'Orders' },
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

/* Dual-role header — used by /orders, /schedule, /settings shared by both farmers and generators. */
export function RoleAwareHeader(props: {
  userProfile: UserProfile | null;
  active: 'orders' | 'schedule' | 'settings';
  profileDropdownOpen: boolean;
  setProfileDropdownOpen: (v: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
  router: any;
}) {
  if (props.userProfile?.role === 'farmer') {
    const farmerKey = props.active === 'schedule' ? 'pickups' : 'orders';
    return (
      <FarmerHeader
        userProfile={props.userProfile}
        active={farmerKey}
        profileDropdownOpen={props.profileDropdownOpen}
        setProfileDropdownOpen={props.setProfileDropdownOpen}
        dropdownRef={props.dropdownRef}
        router={props.router}
      />
    );
  }
  // Generators (or unknown role) get the generator chrome.
  return (
    <GeneratorHeader
      userProfile={props.userProfile}
      active={props.active === 'settings' ? 'dashboard' : props.active}
      profileDropdownOpen={props.profileDropdownOpen}
      setProfileDropdownOpen={props.setProfileDropdownOpen}
      dropdownRef={props.dropdownRef}
      router={props.router}
    />
  );
}
