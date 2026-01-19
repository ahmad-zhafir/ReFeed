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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const role = userProfile?.role;
  const homePath = role === 'generator' ? '/generator' : '/farmer';

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

      <div className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Name</label>
              <input
                type="text"
                value={userProfile?.name || ''}
                disabled
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
              <input
                type="email"
                value={userProfile?.email || ''}
                disabled
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Contact</label>
              <input
                type="tel"
                value={userProfile?.contact || ''}
                disabled
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Role</label>
              <input
                type="text"
                value={role === 'generator' ? 'Restaurant / Generator' : 'Farmer / Receiver'}
                disabled
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          {role === 'farmer' && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Search Radius: <span className="text-emerald-700">{searchRadius} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value, 10))}
                className="w-full mb-2"
              />
              <div className="flex justify-between text-xs text-gray-500 mb-4">
                <span>1km</span>
                <span>20km</span>
              </div>
              <button
                onClick={handleSaveRadius}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Radius'}
              </button>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
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
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

