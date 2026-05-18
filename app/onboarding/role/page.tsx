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
        const unsub = onAuthStateChange((u) => { unsub(); resolve(u); });
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl tracking-tight" style={{ color: 'var(--rf-bone)' }}>
          looking up your seat at the table<span className="animate-pulse">…</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-16"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      {/* Atmospheric layers */}
      <div className="pointer-events-none absolute inset-0 rf-dotgrid opacity-60" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(800px 600px at 15% 10%, rgba(200,255,77,.09), transparent 60%), radial-gradient(700px 500px at 90% 100%, rgba(217,87,42,.10), transparent 60%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 rf-vignette" />

      <div className="relative z-10 max-w-4xl w-full">
        {/* Issue header */}
        <div className="flex items-center justify-between mb-10 rf-fade-up">
          <div className="flex items-center gap-3 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-70">
            <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
            Chapter 01 · Choose your bench
          </div>
          <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60 hidden md:block">
            pp. 01 — A field guide to nothing wasted
          </span>
        </div>

        {/* Headline */}
        <h1 className="rf-headline text-[clamp(2.5rem,7vw,5.5rem)] mb-6 rf-fade-up"
            style={{ animationDelay: '.1s' }}>
          Which side of the
          <br />
          <span className="italic">table</span> are you on?
        </h1>

        <p className="font-instrument italic text-xl md:text-2xl max-w-2xl mb-14 rf-fade-up"
           style={{ color: 'rgba(241,234,216,.7)', animationDelay: '.2s' }}>
          One role, one practice. You can be the kitchen finishing service, or
          the farmer beginning the morning&apos;s feed — not both, not yet.
        </p>

        {/* Choice cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <RoleCard
            num="01"
            eyebrow="The kitchen"
            title="Restaurant"
            italic="Generator"
            body="Post the day's surplus with a photo, price, and a pickup window. Watch it find a field."
            icon="restaurant"
            onClick={() => chooseRole('generator')}
            saving={saving === 'generator'}
            disabled={!!saving}
            delay={0.3}
          />
          <RoleCard
            num="02"
            eyebrow="The field"
            title="Farmer"
            italic="Receiver"
            body="See what's available within your orbit. Claim a parcel, schedule the pickup, close the loop."
            icon="agriculture"
            onClick={() => chooseRole('farmer')}
            saving={saving === 'farmer'}
            disabled={!!saving}
            delay={0.4}
          />
        </div>

        {/* Footnote */}
        <div className="mt-12 grid grid-cols-12 gap-6 items-start rf-fade-up" style={{ animationDelay: '.55s' }}>
          <div className="col-span-12 md:col-span-2 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50">
            §  Footnote
          </div>
          <p className="col-span-12 md:col-span-10 font-instrument italic text-base leading-snug"
             style={{ color: 'rgba(241,234,216,.6)' }}>
            For this edition the role is fixed once set. Future printings will allow a
            quiet trade between benches — a kitchen turned grower, a farmer turned host.
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  num, eyebrow, title, italic, body, icon, onClick, saving, disabled, delay,
}: {
  num: string; eyebrow: string; title: string; italic: string; body: string; icon: string;
  onClick: () => void; saving: boolean; disabled: boolean; delay: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative text-left p-8 rounded-2xl border transition-all hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 rf-fade-up"
      style={{
        borderColor: 'rgba(241,234,216,.16)',
        background: 'rgba(241,234,216,.025)',
        animationDelay: `${delay}s`,
      }}
    >
      <div className="flex items-start justify-between mb-8">
        <span className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none"
              style={{ color: 'var(--rf-sap)' }}>
          {num}
        </span>
        <span className="material-symbols-outlined opacity-60 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--rf-bone)', fontSize: 32 }}>
          {icon}
        </span>
      </div>

      <div className="rf-eyebrow mb-3">{eyebrow}</div>
      <h3 className="font-fraunces fraunces-wonk text-4xl md:text-5xl font-light leading-[0.95] tracking-[-0.03em] mb-2"
          style={{ color: 'var(--rf-bone)' }}>
        {title} <span className="font-instrument italic font-normal" style={{ color: 'var(--rf-sap)' }}>{italic}</span>
      </h3>
      <p className="font-fraunces text-base leading-relaxed mt-4" style={{ color: 'rgba(241,234,216,.72)' }}>
        {body}
      </p>

      <div className="mt-8 flex items-center justify-between">
        <span className="font-mono-jb text-[11px] uppercase tracking-[0.3em] opacity-70 group-hover:opacity-100 transition-opacity">
          {saving ? 'Setting your seat…' : 'Choose this bench →'}
        </span>
        {!saving ? (
          <span className="flex items-center justify-center size-10 rounded-full transition-transform group-hover:rotate-45"
                style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : (
          <span className="size-10 rounded-full flex items-center justify-center"
                style={{ background: 'var(--rf-sap)' }}>
            <span className="size-4 border-2 border-[color:var(--rf-forest)] border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </div>
    </button>
  );
}
