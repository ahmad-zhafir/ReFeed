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
      if (!user) { router.push('/login?redirect=/onboarding/location'); return; }
      const profile = await getUserProfile(user.uid);
      if (!profile?.role) { router.push('/onboarding/role'); return; }
      setRole(profile.role);
      if (profile.searchRadiusKm) setRadiusKm(profile.searchRadiusKm);
      if (profile.location?.latitude && profile.location?.longitude) setLocation(profile.location as any);
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const canSave = useMemo(() => !!role && (!!location || manualAddress.trim().length > 3), [role, location, manualAddress]);

  const requestBrowserLocation = async () => {
    if (!navigator.geolocation) { toast.error('Geolocation is not supported in this browser.'); return; }
    toast.loading('Requesting location…', { id: 'loc' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss('loc');
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
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
    const testAddress = 'FCSIT UPM, Serdang, Selangor, Malaysia';
    toast.loading('Setting test location…', { id: 'test-loc' });
    try {
      const r = await fetch('/api/geocode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: testAddress }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.latitude && d.longitude) {
          setLocation({ latitude: d.latitude, longitude: d.longitude, address: d.formatted_address || testAddress });
          setManualAddress(d.formatted_address || testAddress);
        } else {
          setLocation({ latitude: 2.9885, longitude: 101.7162, address: testAddress });
          setManualAddress(testAddress);
        }
      } else {
        setLocation({ latitude: 2.9885, longitude: 101.7162, address: testAddress });
        setManualAddress(testAddress);
      }
      toast.dismiss('test-loc');
      toast.success('Test location set: FCSIT UPM, Serdang');
    } catch (e) {
      console.error(e);
      setLocation({ latitude: 2.9885, longitude: 101.7162, address: testAddress });
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
        const unsub = onAuthStateChange((u) => { unsub(); resolve(u); });
      });
      if (!user) { router.push('/login?redirect=/onboarding/location'); return; }
      const updates: Partial<UserProfile> = {};
      if (role === 'farmer') updates.searchRadiusKm = radiusKm;
      updates.location = location || { latitude: 0, longitude: 0, address: manualAddress.trim() };
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          finding your patch of soil<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-16"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      <div className="pointer-events-none absolute inset-0 rf-dotgrid opacity-50" />
      <div className="pointer-events-none absolute inset-0"
           style={{ background: 'radial-gradient(900px 600px at 90% 100%, rgba(200,255,77,.10), transparent 60%), radial-gradient(700px 500px at 10% 0%, rgba(217,87,42,.08), transparent 60%)' }} />
      <div className="pointer-events-none absolute inset-0 rf-vignette" />

      <div className="relative z-10 max-w-3xl w-full">
        {/* Step strip */}
        <div className="flex items-center justify-between mb-10 rf-fade-up">
          <div className="rf-eyebrow flex items-center gap-3">
            <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
            Chapter 02 · Your patch of soil
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            Step 02 of 02
          </span>
        </div>

        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-6 rf-fade-up" style={{ animationDelay: '.08s' }}>
          Where do you
          <br />
          <span className="italic">tend?</span>
        </h1>

        <p className="font-instrument italic text-xl md:text-2xl max-w-2xl mb-12 rf-fade-up"
           style={{ color: 'rgba(241,234,216,.7)', animationDelay: '.18s' }}>
          {role === 'farmer'
            ? 'A pin on the map lets the kitchens within your orbit find you.'
            : 'A pin on the map lets the farmers nearby know where to come collect.'}
        </p>

        <div className="space-y-6 rf-fade-up" style={{ animationDelay: '.28s' }}>

          {/* GPS panel */}
          <section className="rounded-2xl p-6 border"
                   style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
            <div className="flex items-baseline justify-between mb-2">
              <div className="rf-eyebrow flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
                01 · GPS — recommended
              </div>
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.3em] opacity-60">±5–10km</span>
            </div>
            <p className="font-instrument italic text-base mb-5" style={{ color: 'rgba(241,234,216,.65)' }}>
              The most accurate way to set your bench.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={requestBrowserLocation}
                      className="group flex-1 inline-flex items-center justify-between pl-5 pr-1.5 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                      style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                <span>Use my location</span>
                <span className="flex items-center justify-center size-9 rounded-full transition-transform group-hover:rotate-45"
                      style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                  <span className="material-symbols-outlined text-lg">my_location</span>
                </span>
              </button>

              {role === 'farmer' && (
                <button onClick={useTestLocation}
                        className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                        style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}
                        title="MVP Demo: Set location to FCSIT UPM, Serdang">
                  <span className="material-symbols-outlined text-base">science</span>
                  Test location
                </button>
              )}
            </div>

            {location && (
              <div className="mt-5 p-4 rounded-xl border flex items-start gap-3"
                   style={{ borderColor: 'rgba(200,255,77,.25)', background: 'rgba(200,255,77,.05)' }}>
                <span className="material-symbols-outlined mt-0.5" style={{ color: 'var(--rf-sap)' }}>check_circle</span>
                <div className="flex-1">
                  <p className="rf-eyebrow mb-1">Saved coordinates</p>
                  <p className="font-mono-jb text-sm" style={{ color: 'var(--rf-sap)' }}>
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </p>
                  {location.address && (
                    <p className="font-instrument italic text-base mt-1" style={{ color: 'var(--rf-bone)' }}>
                      {location.address}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Manual address fallback */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <label className="rf-eyebrow">02 · Address — fallback</label>
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.3em] opacity-50">optional</span>
            </div>
            <input value={manualAddress} onChange={(e) => setManualAddress(e.target.value)}
                   className="rf-input w-full h-12 px-4"
                   placeholder="Enter your address if you can't use GPS…" />
            <p className="font-instrument italic text-sm mt-3" style={{ color: 'rgba(241,234,216,.5)' }}>
              In this edition, address-only won&apos;t power distance filtering — GPS is the proper plot.
            </p>
          </section>

          {/* Radius (farmer only) */}
          {role === 'farmer' && (
            <section className="rounded-2xl p-6 border"
                     style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
              <div className="flex items-baseline justify-between mb-4">
                <label className="rf-eyebrow">03 · The orbit</label>
                <span className="font-fraunces fraunces-wonk italic text-3xl font-light leading-none"
                      style={{ color: 'var(--rf-sap)' }}>
                  {radiusKm}<span className="font-mono-jb text-xs ml-1 not-italic opacity-70">km</span>
                </span>
              </div>
              <div className="relative h-1.5 rounded-full" style={{ background: 'rgba(241,234,216,.1)' }}>
                <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                     style={{ width: `${((radiusKm - 1) / 49) * 100}%`, background: 'var(--rf-sap)' }} />
                <input type="range" min={1} max={50} step={1} value={radiusKm}
                       onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="absolute top-1/2 -translate-y-1/2 size-4 rounded-full border-2 pointer-events-none"
                     style={{ left: `calc(${((radiusKm - 1) / 49) * 100}% - 8px)`, background: 'var(--rf-sap)', borderColor: 'var(--rf-forest)' }} />
              </div>
              <div className="flex justify-between mt-2 font-mono-jb text-[9px] uppercase tracking-[0.2em] opacity-50">
                <span>1km</span><span>50km</span>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-3 pt-4">
            <button onClick={() => router.push('/onboarding/role')}
                    className="inline-flex items-center justify-center h-14 px-6 rounded-full font-mono-jb text-[11px] uppercase tracking-[0.25em] border transition-all hover:bg-white/5"
                    style={{ borderColor: 'rgba(241,234,216,.2)', color: 'var(--rf-bone)' }}>
              ← Back
            </button>
            <button onClick={save} disabled={!canSave || saving}
                    className="group inline-flex items-center justify-between gap-4 pl-7 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed rf-glow-sap"
                    style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
              <span>{saving ? 'Planting your pin…' : 'Continue →'}</span>
              <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                    style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                {saving ? (
                  <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
