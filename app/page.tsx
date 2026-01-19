'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange, signOut } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { UserProfile } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleGetStarted = () => {
    if (user) {
      if (userProfile?.role === 'generator') {
        router.push('/generator');
      } else if (userProfile?.role === 'farmer') {
        router.push('/farmer');
      } else {
        router.push('/onboarding/role');
      }
    } else {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#102213]">
        <div className="text-xl text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#102213] text-white font-display antialiased overflow-x-hidden flex flex-col min-h-screen">
      {/* Header */}
      <header className="absolute top-0 z-50 w-full border-b border-white/10">
        <div className="px-6 md:px-10 py-4 flex items-center justify-between mx-auto max-w-7xl">
          <Link href="/" className="flex items-center gap-4 text-white cursor-pointer">
            <div className="size-8 text-[#13ec37]">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">ReFeed</h2>
          </Link>

          <nav className="hidden md:flex flex-1 justify-end gap-8 items-center">
            <div className="flex items-center gap-8">
              <Link href="#about" className="text-white/90 hover:text-[#13ec37] transition-colors text-sm font-medium leading-normal">
                About
              </Link>
              <Link href="#impact" className="text-white/90 hover:text-[#13ec37] transition-colors text-sm font-medium leading-normal">
                Impact
              </Link>
              <Link href="#partners" className="text-white/90 hover:text-[#13ec37] transition-colors text-sm font-medium leading-normal">
                Partners
              </Link>
            </div>
            {user && userProfile ? (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 transition-colors text-sm font-bold leading-normal"
                >
                  <span className="truncate">{userProfile.name}</span>
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#19331e] rounded-lg shadow-xl border border-white/10 py-2 z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-semibold text-white">{userProfile.name}</p>
                      <p className="text-xs text-white/60 mt-1">{userProfile.contact}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setProfileDropdownOpen(false);
                          await signOut();
                          await new Promise(resolve => setTimeout(resolve, 100));
                          router.push('/');
                        } catch (error: any) {
                          console.error('Logout error:', error);
                          alert('Failed to sign out. Please try again.');
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 transition-colors text-sm font-bold leading-normal"
                >
                  <span className="truncate">Account</span>
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#19331e] rounded-lg shadow-xl border border-white/10 py-2 z-50">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-semibold text-white">{user.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setProfileDropdownOpen(false);
                          await signOut();
                          await new Promise(resolve => setTimeout(resolve, 100));
                          router.push('/');
                        } catch (error: any) {
                          console.error('Logout error:', error);
                          alert('Failed to sign out. Please try again.');
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-red-400 hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 transition-colors text-sm font-bold leading-normal"
              >
                <span className="truncate">Sign In</span>
              </Link>
            )}
          </nav>

          <div className="md:hidden text-white">
            <span className="material-symbols-outlined">menu</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-grow flex flex-col justify-center items-center w-full min-h-screen">
        {/* Background Image */}
        <div 
          className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat" 
          style={{
            backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-UfDZUpEAXAScgAFdJ6Ivt_P8n3HDc1Fibv9mqgnRJC010Fpz4a7_ZoZnCKe50bjaGb4nKIs9Xmpa7L0Q3xlZkPPlK7qiG_63z6OTag0dRGrzXea-FkqFFkE7-x0g60wu5rPhigtDIRhk1QEuSF128Ns2ahjAhuJEvlHXtArd4IqGknv39Kn0dTe_UOfNks0cGA4XMA1Fe4u-sT7z-dFV5hpaJ-2azacOO3MU2jeB9W7u_fTwxVecXUjZXUQ80cc1GBqcBvaimdY")'
          }}
        ></div>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 z-0 bg-black/60"></div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center text-center mt-12">
          {/* Sustainable Ecosystem Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#13ec37]/10 border border-[#13ec37]/20 backdrop-blur-md mb-8">
            <span className="material-symbols-outlined text-[#13ec37] text-sm">recycling</span>
            <span className="text-[#13ec37] text-xs font-bold uppercase tracking-wider">Sustainable Ecosystem</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-white text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] tracking-tight mb-6">
            Reduce waste, <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#13ec37] to-green-400">maximize value.</span>
          </h1>

          {/* Description */}
          <p className="text-white/90 text-lg md:text-xl font-light leading-relaxed max-w-2xl mb-10">
            Connect directly with local farmers to reduce food waste. Join the circular economy platform that powers the future of food.
          </p>

          {/* Get Started Button */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button
              onClick={handleGetStarted}
              className="flex items-center justify-center cursor-pointer rounded-lg px-8 py-4 bg-[#13ec37] hover:bg-[#0fd630] text-[#102213] text-lg font-bold leading-normal transition-all shadow-[0_0_20px_rgba(19,236,55,0.4)] hover:shadow-[0_0_30px_rgba(19,236,55,0.6)] hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>

          {/* Trust Indicator */}
          <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/10 w-full max-w-xs">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                <Image
                  alt="User avatar"
                  className="w-10 h-10 rounded-full border-2 border-white/10 object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPQRKxhk5I4kb2KTf2EzYyJBJr9Ad_BvkdDBbRhJDyQW-RW1K0j8bnLImYzq4mohhMn2FF0AcjIrmIy7IpOtDH9k285AJ1tCvcmFwalvpt1wJ2h47p_lr0o4_YQ2GE6_s3qq5MFia-rVNYFG0g8pjYsuPiQyTJGmIgym8YdVCCg2GqOibrtpoOkEkuXZX1owcNoEnPPipAC710HqtZ-ELD2JPTs4E6aAL4IKUqgKuz-tB25IHBVxzQkw4P1vvVwobIl08oL19kQrs"
                  width={40}
                  height={40}
                />
                <Image
                  alt="User avatar"
                  className="w-10 h-10 rounded-full border-2 border-white/10 object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-tNdrH4oUqhc8YnGOniS3a_eUoh5h9Cfzo9z27PInJc25RGSvB-z8Q_CbAlVrARiny5HPpNxfvK3blJN7Jd9H8zPQYrza1qtC7lmxbahdoxjfWiYLJ5SmjdFJtjyZGYLjmFfBNHEmpRouvQ6XKOqJIXF53JqjyVU1qAZUhoSwNUbomJ93sxS8_qmIDV6h_SG3ZK2Lr0hz-nA3gpNBuKPB2sXPybxU1xXGWQJC17Z8fIlWSdPfr4z0Mj7CuggbbPYdHPAmwO4-DMQ"
                  width={40}
                  height={40}
                />
                <Image
                  alt="User avatar"
                  className="w-10 h-10 rounded-full border-2 border-white/10 object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8jv1KTaBhuJwyg0ezV3JHPFOsfepgDSGoJ5HKcbZdp-9kP_druc4F8rIUXYol8zduaqJ2Yn5MRHdgoaj8RK_ptGfVJvCElP_ut1LxPJAjvR2X5nvwQTjmBvRqqTnnLqIuOYkAYt6TYMIHKtYGpFfT7vbdq2qr6i8M72fKbTwbgmq_RmCPCk8ExDm4AF7Eww7MBuSsXEU_lxtvss0KfEmE7mp1A0FDRx1PmnSUKctvRm53Mt4ubDZBf_3EfJdK6uf07gva4q2jTT4"
                  width={40}
                  height={40}
                />
              </div>
              <span className="text-sm font-medium text-white/90">Trusted by 2,000+ partners</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 text-xs font-medium text-white/60 z-10">
          <Link href="#help" className="hover:text-[#13ec37] transition-colors">Help Center</Link>
          <Link href="#status" className="hover:text-[#13ec37] transition-colors">Platform Status</Link>
          <Link href="#privacy" className="hover:text-[#13ec37] transition-colors">Privacy Policy</Link>
        </div>
      </main>
    </div>
  );
}
