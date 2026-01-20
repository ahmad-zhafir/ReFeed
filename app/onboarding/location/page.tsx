'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
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

  const useTestLocation = async () => {
    // Test location: FCSIT UPM, Serdang
    const testAddress = 'FCSIT UPM, Serdang, Selangor, Malaysia';
    
    toast.loading('Setting test location…', { id: 'test-loc' });
    
    try {
      // Try to geocode the address
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: testAddress }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.latitude && data.longitude) {
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.formatted_address || testAddress,
          });
          setManualAddress(data.formatted_address || testAddress);
          toast.dismiss('test-loc');
          toast.success('Test location set: FCSIT UPM, Serdang');
        } else {
          // Fallback to hardcoded coordinates if geocoding fails
          setLocation({
            latitude: 2.9885,
            longitude: 101.7162,
            address: testAddress,
          });
          setManualAddress(testAddress);
          toast.dismiss('test-loc');
          toast.success('Test location set: FCSIT UPM, Serdang');
        }
      } else {
        // Fallback to hardcoded coordinates if API fails
        setLocation({
          latitude: 2.9885,
          longitude: 101.7162,
          address: testAddress,
        });
        setManualAddress(testAddress);
        toast.dismiss('test-loc');
        toast.success('Test location set: FCSIT UPM, Serdang');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      // Fallback to hardcoded coordinates
      setLocation({
        latitude: 2.9885,
        longitude: 101.7162,
        address: testAddress,
      });
      setManualAddress(testAddress);
      toast.dismiss('test-loc');
      toast.success('Test location set: FCSIT UPM, Serdang');
    }
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
              Location & matching
            </h1>
            <p className="text-[#92c99b] text-sm mt-1">
              We use your location to show nearby listings. Farmers can adjust their search radius.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[#234829] bg-[#234829]/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#13ec37]">location_on</span>
              <p className="text-sm font-bold text-white uppercase tracking-wide">Capture GPS (recommended)</p>
            </div>
            <p className="text-sm text-[#92c99b] mb-4">Works best for 5–10km matching.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={requestBrowserLocation}
                className="flex-1 px-6 py-3 rounded-lg bg-[#13ec37] hover:bg-[#11d632] text-[#112214] font-bold transition-all shadow-[0_0_15px_rgba(19,236,55,0.3)] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">my_location</span>
                Use my current location
              </button>
              
              {role === 'farmer' && (
                <button
                  onClick={useTestLocation}
                  className="flex-1 px-6 py-3 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 hover:text-yellow-300 font-bold transition-all border border-yellow-500/30 hover:border-yellow-500/50 flex items-center justify-center gap-2"
                  title="MVP Demo: Set location to FCSIT UPM, Serdang"
                >
                  <span className="material-symbols-outlined text-lg">science</span>
                  Use Test Location
                </button>
              )}
            </div>

            {location && (
              <div className="mt-4 p-3 bg-[#112214] rounded-lg border border-[#13ec37]/20">
                <p className="text-xs text-[#92c99b] mb-1">
                  <span className="font-semibold text-white">Saved coordinates:</span>
                </p>
                <p className="text-sm text-[#13ec37] font-mono mb-2">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </p>
                {location.address && (
                  <p className="text-xs text-[#92c99b]">
                    <span className="font-semibold text-white">Address:</span> {location.address}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c99b] mb-2">
              Address (fallback)
            </label>
            <input
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#102213] border border-[#234829] text-white placeholder:text-[#92c99b]/50 focus:ring-2 focus:ring-[#13ec37] focus:border-[#13ec37] transition-all"
              placeholder="Enter your address if you can't use GPS"
            />
            <p className="text-xs text-[#92c99b]/70 mt-2 flex items-start gap-1">
              <span className="material-symbols-outlined text-xs">info</span>
              For this prototype, address-only won't power distance filtering unless GPS is enabled.
            </p>
          </div>

          {role === 'farmer' && (
            <div className="p-6 rounded-xl border border-[#234829] bg-[#234829]/30">
              <label className="block text-sm font-medium text-[#92c99b] mb-3">
                Search radius: <span className="text-[#13ec37] font-bold">{radiusKm} km</span>
              </label>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
                className="w-full accent-[#13ec37]"
              />
              <div className="flex justify-between text-xs text-[#92c99b] mt-2">
                <span>1km</span>
                <span>50km</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => router.push('/onboarding/role')}
              className="px-6 py-3 rounded-lg bg-[#234829] hover:bg-[#234829]/80 text-[#92c99b] hover:text-white font-semibold transition-colors border border-[#234829]"
            >
              Back
            </button>
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="px-6 py-3 rounded-lg bg-[#13ec37] hover:bg-[#11d632] text-[#112214] font-bold disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(19,236,55,0.3)] flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#112214]"></div>
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


