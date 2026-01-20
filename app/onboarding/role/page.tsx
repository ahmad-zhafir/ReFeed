'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange } from '@/lib/firebase';
import { getUserProfile, setUserRoleOnce } from '@/lib/userProfile';
import type { MarketplaceRole } from '@/lib/types';
import toast from 'react-hot-toast';

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
      <div className="min-h-screen flex items-center justify-center bg-[#102213]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13ec37] mx-auto mb-4"></div>
          <p className="text-white font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#102213] flex items-center justify-center px-4 py-10">
      <div className="max-w-2xl w-full bg-[#1c2e20] rounded-xl shadow-2xl border border-[#234829] p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-10 text-[#13ec37]">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Choose your role
            </h1>
            <p className="text-[#92c99b] text-sm mt-1">
              You can only have <span className="font-semibold text-white">one role</span> in this prototype.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => chooseRole('generator')}
            disabled={!!saving}
            className="text-left p-6 rounded-xl border border-[#234829] hover:border-[#13ec37]/50 hover:bg-[#234829]/50 bg-[#112214] transition-all disabled:opacity-60 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[#13ec37] text-2xl">restaurant</span>
              <p className="text-sm font-semibold text-[#13ec37] uppercase tracking-wide">Restaurant / Food Generator</p>
            </div>
            <p className="text-xl font-black text-white mt-2">Sell surplus waste feed</p>
            <p className="text-sm text-[#92c99b] mt-3">
              Post listings with photos, price, and pickup windows.
            </p>
            {saving === 'generator' && (
              <div className="mt-4 flex items-center gap-2 text-[#92c99b]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#13ec37]"></div>
                <p className="text-sm">Saving…</p>
              </div>
            )}
          </button>

          <button
            onClick={() => chooseRole('farmer')}
            disabled={!!saving}
            className="text-left p-6 rounded-xl border border-[#234829] hover:border-[#13ec37]/50 hover:bg-[#234829]/50 bg-[#112214] transition-all disabled:opacity-60 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[#13ec37] text-2xl">agriculture</span>
              <p className="text-sm font-semibold text-[#13ec37] uppercase tracking-wide">Farmer / Waste Receiver</p>
            </div>
            <p className="text-xl font-black text-white mt-2">Buy nearby waste at low price</p>
            <p className="text-sm text-[#92c99b] mt-3">
              Browse listings within your chosen radius and claim first-come-first-serve.
            </p>
            {saving === 'farmer' && (
              <div className="mt-4 flex items-center gap-2 text-[#92c99b]">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#13ec37]"></div>
                <p className="text-sm">Saving…</p>
              </div>
            )}
          </button>
        </div>

        <div className="mt-8 p-4 bg-[#234829]/30 rounded-lg border border-[#234829]">
          <p className="text-xs text-[#92c99b]">
            <span className="material-symbols-outlined text-sm text-[#13ec37] align-middle mr-1">info</span>
            Tip: you can change role later only by deleting the user document or using an admin tool (not included in prototype).
          </p>
        </div>
      </div>
    </div>
  );
}


