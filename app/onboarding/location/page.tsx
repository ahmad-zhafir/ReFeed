'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Logo from '@/components/Logo';
import { onAuthStateChange } from '@/lib/firebase';
import { getUserProfile, updateUserProfile } from '@/lib/userProfile';
import type { MarketplaceRole, UserProfile } from '@/lib/types';

type Loc = { latitude: number; longitude: number; address?: string };

export default function LocationOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<MarketplaceRole | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [location, setLocation] = useState<Loc | null>(null);
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChange(async (user) => {
      if (!user) {
        router.push('/login?redirect=/onboarding/location');
        return;
      }

      const profile = await getUserProfile(user.uid);
      if (!profile?.role) {
        router.push('/onboarding/role');
        return;
      }

      setRole(profile.role);
      if (profile.searchRadiusKm) setRadiusKm(profile.searchRadiusKm);
      if (profile.location?.latitude && profile.location?.longitude) {
        setLocation(profile.location as any);
      }

      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const canSave = useMemo(() => {
    return !!role && (!!location || manualAddress.trim().length > 3);
  }, [role, location, manualAddress]);

  const requestBrowserLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser.');
      return;
    }
    toast.loading('Requesting location…', { id: 'loc' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss('loc');
        const loc: Loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(loc);
        toast.success('Location captured.');
      },
      (err) => {
        toast.dismiss('loc');
        console.error(err);
        toast.error('Location permission denied. You can enter an address instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const user = await new Promise<Parameters<Parameters<typeof onAuthStateChange>[0]>[0]>((resolve) => {
        const unsub = onAuthStateChange((u) => {
          unsub();
          resolve(u);
        });
      });
      if (!user) {
        router.push('/login?redirect=/onboarding/location');
        return;
      }

      const updates: Partial<UserProfile> = {};
      
      // Only set searchRadiusKm for farmers
      if (role === 'farmer') {
        updates.searchRadiusKm = radiusKm;
      }

      if (location) {
        updates.location = location;
      } else {
        updates.location = { latitude: 0, longitude: 0, address: manualAddress.trim() };
      }

      await updateUserProfile(user.uid, updates);
      toast.success('Saved.');
      router.push(role === 'generator' ? '/generator' : '/farmer');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
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
              Location & matching
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              We use your location to show nearby listings. Farmers can adjust their search radius.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900">Capture GPS (recommended)</p>
            <p className="text-sm text-gray-600 mt-1">Works best for 5–10km matching.</p>
            <button
              onClick={requestBrowserLocation}
              className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              Use my current location
            </button>

            {location && (
              <div className="mt-3 text-sm text-gray-700">
                <span className="font-semibold">Saved coordinates:</span> {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Address (fallback)
            </label>
            <input
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-gray-900"
              placeholder="Enter your address if you can't use GPS"
            />
            <p className="text-xs text-gray-500 mt-1">
              For this prototype, address-only won’t power distance filtering unless GPS is enabled.
            </p>
          </div>

          {role === 'farmer' && (
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Search radius: <span className="text-emerald-700">{radiusKm} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1km</span>
                <span>20km</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push('/onboarding/role')}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 font-semibold hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


