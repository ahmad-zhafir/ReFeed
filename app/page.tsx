'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, onAuthStateChange, signOut } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import Link from 'next/link';
import Image from 'next/image';
import Logo from '@/components/Logo';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userType, setUserType] = useState<'donor' | 'claimer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cardsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Close dropdown when clicking outside
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

  const handleDonorClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      router.push('/login?redirect=/donor');
    }
  };

  const handleClaimerClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      router.push('/login?redirect=/claimer');
    }
  };

  const handleGetStarted = () => {
    cardsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3">
              <Logo className="w-10 h-10" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" style={{ fontFamily: '"Lilita One", sans-serif' }}>
                Food Loop
              </h1>
            </Link>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {user && userProfile ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                      <span className="text-white font-semibold text-sm">{userProfile.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                      <p className="text-xs text-gray-500">{userProfile.contact}</p>
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900">{userProfile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{userProfile.contact}</p>
                        <p className="text-xs text-gray-400 mt-1">{userProfile.email}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await signOut();
                          setProfileDropdownOpen(false);
                          router.push('/');
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : user ? (
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-50 border border-gray-200">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                    <span className="text-white font-semibold text-sm">{user.email?.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700">{user.email}</span>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 rounded-full hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
                >
                  Sign In / Sign Up
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 pt-12 pb-20 md:pt-16 md:pb-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Connecting Communities, Reducing Waste
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-6 leading-tight">
              Turn Surplus Food Into
              <span className="block text-green-600">Shared Meals</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect local food donors with claimers in real-time. Help reduce food waste while feeding your community.
            </p>
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full text-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Get Started
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Action Cards */}
      <section ref={cardsSectionRef} className="container mx-auto px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <Link
              href={user ? "/donor" : "#"}
              onClick={handleDonorClick}
              className="group relative bg-white rounded-3xl shadow-xl border border-gray-100 p-10 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
              
              <div className="relative">
                <div className="w-16 h-16 mb-6 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform p-1">
                  <Image
                    src="/images/donate.svg"
                    alt="Donate Icon"
                    width={72}
                    height={72}
                    className="object-contain"
                  />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">I'm a Donor</h3>
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  Post your surplus food listings and help reduce waste in your community. Make a difference with every donation.
                </p>
                {!user ? (
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold border border-gray-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Sign in required
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-green-600 font-semibold group-hover:gap-3 transition-all">
                    Get Started
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            </Link>

            <Link
              href={user ? "/claimer" : "#"}
              onClick={handleClaimerClick}
              className="group relative bg-white rounded-3xl shadow-xl border border-gray-100 p-10 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity"></div>
              
              <div className="relative">
                <div className="w-16 h-16 mb-6 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform p-1">
                  <Image
                    src="/images/claim.svg"
                    alt="Claim Icon"
                    width={72}
                    height={72}
                    className="object-contain"
                  />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">I'm a Claimer</h3>
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  Browse available food listings on the map and claim items near you. Discover fresh meals in your neighborhood.
                </p>
                {!user ? (
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold border border-gray-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Sign in required
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-orange-600 font-semibold group-hover:gap-3 transition-all">
                    Get Started
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

