'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange } from '@/lib/firebase';
import { getUserProfile, setUserRoleOnce } from '@/lib/userProfile';
import type { MarketplaceRole } from '@/lib/types';
import toast from 'react-hot-toast';
import Logo from '@/components/Logo';

export default function RoleOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<MarketplaceRole | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChange(async (user) => {
      if (!user) {
        router.push('/login?redirect=/onboarding/role');
        return;
      }

      const profile = await getUserProfile(user.uid);
      // If role already chosen, go to location setup (or home routing later)
      if (profile?.role) {
        router.push('/onboarding/location');
        return;
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  const chooseRole = async (role: MarketplaceRole) => {
    if (saving) return;
    setSaving(role);
    try {
      const user = await new Promise<Parameters<Parameters<typeof onAuthStateChange>[0]>[0]>((resolve) => {
        const unsub = onAuthStateChange((u) => {
          unsub();
          resolve(u);
        });
      });

      if (!user) {
        router.push('/login?redirect=/onboarding/role');
        return;
      }

      await setUserRoleOnce(user.uid, role);
      toast.success(`Role set: ${role === 'generator' ? 'Restaurant / Generator' : 'Farmer'}`);
      router.push('/onboarding/location');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to set role. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-green-50 to-emerald-100">
        <div className="text-gray-700 font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900" style={{ fontFamily: '"Lilita One", sans-serif' }}>
              Choose your role
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              You can only have <span className="font-semibold">one role</span> in this prototype.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => chooseRole('generator')}
            disabled={!!saving}
            className="text-left p-6 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all disabled:opacity-60"
          >
            <p className="text-sm font-semibold text-emerald-700">Restaurant / Food Generator</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">Sell surplus waste feed</p>
            <p className="text-sm text-gray-600 mt-2">
              Post listings with photos, price, and pickup windows.
            </p>
            {saving === 'generator' && <p className="text-sm text-gray-500 mt-3">Saving…</p>}
          </button>

          <button
            onClick={() => chooseRole('farmer')}
            disabled={!!saving}
            className="text-left p-6 rounded-2xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all disabled:opacity-60"
          >
            <p className="text-sm font-semibold text-orange-700">Farmer / Waste Receiver</p>
            <p className="text-xl font-extrabold text-gray-900 mt-1">Buy nearby waste at low price</p>
            <p className="text-sm text-gray-600 mt-2">
              Browse listings within your chosen radius and claim first-come-first-serve.
            </p>
            {saving === 'farmer' && <p className="text-sm text-gray-500 mt-3">Saving…</p>}
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: you can change role later only by deleting the user document or using an admin tool (not included in prototype).
        </div>
      </div>
    </div>
  );
}


