'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange, signOut } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { UserProfile, MarketplaceRole } from '@/lib/types';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import AuthGuard from '@/components/AuthGuard';
import Logo from '@/components/Logo';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsContent />
    </AuthGuard>
  );
}

function SettingsContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        setUserProfile(profile);
        if (profile?.searchRadiusKm) {
          setSearchRadius(profile.searchRadiusKm);
        }
        setLoading(false);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSaveRadius = async () => {
    if (!user || userProfile?.role !== 'farmer') return;
    
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { searchRadiusKm: searchRadius });
      toast.success('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
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

  return (
    <div className="font-display bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white antialiased min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#102213]/80 backdrop-blur-md">
        <div className="px-6 md:px-10 py-3 flex items-center justify-between w-full">
          <Link href={homePath} className="flex items-center gap-4 text-slate-900 dark:text-white cursor-pointer">
            <div className="size-8 text-[#13ec37]">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">ReFeed</h2>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <div className="bg-[#1c2e20] border border-[#234829] rounded-xl shadow-lg p-6 md:p-8 relative">
          {/* Back Button - Top Left */}
          <div className="flex justify-start mb-4">
            <Link
              href={homePath}
              className="flex items-center gap-2 px-4 py-2 bg-[#234829] hover:bg-[#13ec37]/20 text-[#92c99b] hover:text-white border border-[#234829] hover:border-[#13ec37]/50 rounded-lg transition-all font-medium text-sm"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Back to Dashboard</span>
            </Link>
          </div>
          
          {/* Settings Title - Centered */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="material-symbols-outlined text-[#13ec37] text-2xl">settings</span>
            <h2 className="text-2xl font-bold text-white">Settings</h2>
          </div>
          
          <div className="space-y-5 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Name</label>
              <input
                type="text"
                value={userProfile?.name || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Email</label>
              <input
                type="email"
                value={userProfile?.email || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Contact</label>
              <input
                type="tel"
                value={userProfile?.contact || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c99b] mb-2">Role</label>
              <input
                type="text"
                value={role === 'generator' ? 'Restaurant / Generator' : 'Farmer / Receiver'}
                disabled
                className="w-full px-4 py-2.5 rounded-lg border-none bg-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-1 focus:ring-[#13ec37] focus:border-[#13ec37] sm:text-sm"
              />
            </div>
          </div>

          {role === 'farmer' && (
            <div className="mb-6 p-4 bg-[#234829] rounded-lg border border-[#234829]">
              <label className="block text-sm font-medium text-[#92c99b] mb-3">
                Search Radius: <span className="text-[#13ec37] font-bold">{searchRadius} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value, 10))}
                className="w-full mb-2 accent-[#13ec37]"
              />
              <div className="flex justify-between text-xs text-[#92c99b] mb-4">
                <span>1km</span>
                <span>20km</span>
              </div>
              <button
                onClick={handleSaveRadius}
                disabled={saving}
                className="px-6 py-2.5 bg-[#13ec37] hover:bg-[#11d632] text-[#112214] rounded-lg disabled:opacity-50 transition-all font-bold shadow-[0_0_15px_rgba(19,236,55,0.3)]"
              >
                {saving ? 'Saving...' : 'Save Radius'}
              </button>
            </div>
          )}

          <div className="border-t border-[#234829] pt-6">
            <button
              onClick={async () => {
                try {
                  await signOut();
                  await new Promise(resolve => setTimeout(resolve, 100));
                  router.push('/');
                } catch (error: any) {
                  console.error('Logout error:', error);
                  toast.error('Failed to sign out');
                }
              }}
              className="w-full px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">logout</span>
              Sign Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

