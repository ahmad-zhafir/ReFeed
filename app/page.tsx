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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileDropdownOpen]);

  const handleGetStarted = () => {
    if (user) {
      if (userProfile?.role === 'generator') router.push('/generator');
      else if (userProfile?.role === 'farmer') router.push('/farmer');
      else router.push('/onboarding/role');
    } else {
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <div className="font-instrument italic text-2xl tracking-tight" style={{ color: 'var(--rf-bone)' }}>
          sowing the page<span className="animate-pulse">…</span>
        </div>
      </div>
    );
  }

  // Stats for the marquee
  const marqueeItems = [
    '◍  2,481 KG OF FOOD RESCUED THIS WEEK',
    '✺  407 FARMERS ACTIVELY FORAGING',
    '☘  17 CITIES IN THE NETWORK',
    '◐  CIRCULAR ECONOMY · EST. 2024',
    '⌁  POWERED BY LOCAL LOGISTICS',
    '✦  FROM SCRAPS TO SOIL IN < 24 HRS',
  ];

  return (
    <div
      className="font-fraunces antialiased overflow-x-hidden flex flex-col min-h-screen relative"
      style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}
    >
      {/* Background atmospheric layers */}
      <div className="pointer-events-none absolute inset-0 rf-dotgrid opacity-60" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 600px at 12% 8%, rgba(200,255,77,.10), transparent 60%), radial-gradient(700px 500px at 90% 100%, rgba(217,87,42,.12), transparent 60%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 rf-vignette" />

      {/* HEADER */}
      <header className="absolute top-0 z-50 w-full">
        <div
          className="w-full px-6 md:px-10 py-5 flex items-center justify-between border-b"
          style={{ borderColor: 'rgba(241,234,216,.12)' }}
        >
          <Link href="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="relative size-9">
              <Image
                src="/images/logo.svg"
                alt="ReFeed logo"
                fill
                sizes="36px"
                priority
                className="object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <h2 className="font-fraunces fraunces-wonk text-2xl font-black tracking-[-0.03em]"
                  style={{ color: 'var(--rf-bone)' }}>
                Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
              </h2>
              <span className="font-mono-jb text-[9px] uppercase tracking-[0.32em] mt-1 opacity-60">
                Circular · Local · Living
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex flex-1 justify-end gap-10 items-center">
            <div className="flex items-center gap-8 font-mono-jb text-[11px] uppercase tracking-[0.25em]">
              <Link href="#about" className="opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] transition-all">
                <span className="opacity-50 mr-2">01</span>About
              </Link>
              <Link href="#impact" className="opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] transition-all">
                <span className="opacity-50 mr-2">02</span>Impact
              </Link>
              <Link href="#manifesto" className="opacity-70 hover:opacity-100 hover:text-[color:var(--rf-sap)] transition-all">
                <span className="opacity-50 mr-2">03</span>Manifesto
              </Link>
            </div>

            {user && userProfile ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="font-mono-jb text-[11px] uppercase tracking-[0.2em] px-5 h-10 rounded-full border flex items-center gap-2 transition-all hover:bg-white/5"
                  style={{ borderColor: 'rgba(241,234,216,.25)' }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
                  <span className="truncate max-w-[120px]">{userProfile.name}</span>
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-64 rounded-2xl shadow-2xl py-2 z-50 border"
                       style={{ background: 'var(--rf-moss)', borderColor: 'rgba(241,234,216,.12)' }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(241,234,216,.1)' }}>
                      <p className="font-fraunces text-base font-semibold" style={{ color: 'var(--rf-bone)' }}>
                        {userProfile.name}
                      </p>
                      <p className="font-mono-jb text-[10px] uppercase tracking-wider opacity-60 mt-1">
                        {userProfile.contact}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setProfileDropdownOpen(false);
                          await signOut();
                          await new Promise((r) => setTimeout(r, 100));
                          router.push('/');
                        } catch (e) {
                          alert('Failed to sign out. Please try again.');
                        }
                      }}
                      className="w-full text-left px-4 py-3 font-mono-jb text-[11px] uppercase tracking-[0.2em] hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--rf-rust)' }}
                    >
                      → Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="font-mono-jb text-[11px] uppercase tracking-[0.2em] px-5 h-10 rounded-full border flex items-center gap-2 hover:bg-white/5 transition-all"
                  style={{ borderColor: 'rgba(241,234,216,.25)' }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
                  Account
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-64 rounded-2xl shadow-2xl py-2 z-50 border"
                       style={{ background: 'var(--rf-moss)', borderColor: 'rgba(241,234,216,.12)' }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(241,234,216,.1)' }}>
                      <p className="font-fraunces text-sm" style={{ color: 'var(--rf-bone)' }}>{user.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setProfileDropdownOpen(false);
                          await signOut();
                          await new Promise((r) => setTimeout(r, 100));
                          router.push('/');
                        } catch {
                          alert('Failed to sign out. Please try again.');
                        }
                      }}
                      className="w-full text-left px-4 py-3 font-mono-jb text-[11px] uppercase tracking-[0.2em] hover:bg-white/5 transition-colors"
                      style={{ color: 'var(--rf-rust)' }}
                    >
                      → Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="font-mono-jb text-[11px] uppercase tracking-[0.2em] px-5 h-10 rounded-full border flex items-center gap-2 hover:bg-white/5 transition-all"
                style={{ borderColor: 'rgba(241,234,216,.25)' }}
              >
                Sign In <span aria-hidden>→</span>
              </Link>
            )}
          </nav>

          <div className="md:hidden">
            <span className="material-symbols-outlined" style={{ color: 'var(--rf-bone)' }}>menu</span>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="relative flex-grow flex flex-col w-full z-10">
        {/* Side meta — vertical text on the left */}
        <div className="hidden lg:flex absolute left-6 top-0 bottom-0 items-center z-20">
          <p className="rf-vertical font-mono-jb text-[10px] uppercase tracking-[0.4em] opacity-50">
            ReFeed · No.001 · {new Date().getFullYear()} · An almanac of returns
          </p>
        </div>

        {/* Side meta — right */}
        <div className="hidden lg:flex absolute right-6 top-0 bottom-0 items-center z-20">
          <p className="rf-vertical font-mono-jb text-[10px] uppercase tracking-[0.4em] opacity-50">
            Soil ↻ Plate ↻ Soil · Volume One
          </p>
        </div>

        <section className="relative pt-32 md:pt-40 pb-24 px-6 md:px-16 lg:px-24">
          <div className="max-w-7xl mx-auto">

            {/* Issue strip */}
            <div className="flex items-center justify-between mb-10 rf-fade-up" style={{ animationDelay: '.05s' }}>
              <div className="flex items-center gap-3 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-70">
                <span className="size-2 rounded-full animate-pulse" style={{ background: 'var(--rf-sap)' }} />
                Live · {new Date().toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
              </div>
              <div className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-70 hidden md:block">
                Issue №001 — The Returning
              </div>
            </div>

            {/* Hero — asymmetric editorial */}
            <div className="grid grid-cols-12 gap-y-8 gap-x-6 items-end">

              {/* Eyebrow */}
              <div className="col-span-12 md:col-span-7 rf-fade-up" style={{ animationDelay: '.15s' }}>
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border"
                     style={{ borderColor: 'rgba(200,255,77,.4)', background: 'rgba(200,255,77,.05)' }}>
                  <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
                  <span className="font-mono-jb text-[10px] uppercase tracking-[0.35em]"
                        style={{ color: 'var(--rf-sap)' }}>
                    A field guide to nothing wasted
                  </span>
                </div>
              </div>

              {/* Headline */}
              <h1
                className="col-span-12 fraunces-wonk text-[clamp(3.5rem,11vw,11rem)] font-light leading-[0.9] tracking-[-0.04em] rf-fade-up"
                style={{ animationDelay: '.25s', color: 'var(--rf-bone)' }}
              >
                Yesterday&rsquo;s
                <br />
                <span className="italic font-instrument" style={{ color: 'var(--rf-sap)' }}>scraps,</span>
                <span className="opacity-90"> tomorrow&rsquo;s</span>
                <br />
                <span className="relative inline-block">
                  harvest.
                  <svg
                    className="absolute -bottom-4 left-0 w-full"
                    viewBox="0 0 600 24"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M2 14 Q 120 2, 240 14 T 480 12 T 598 14"
                      fill="none"
                      stroke="var(--rf-sap)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* Lede + CTA — split layout */}
              <div className="col-span-12 md:col-span-7 lg:col-span-6 mt-12 md:mt-16 rf-fade-up"
                   style={{ animationDelay: '.45s' }}>
                <p className="font-fraunces text-xl md:text-2xl leading-[1.4] tracking-tight text-pretty"
                   style={{ color: 'rgba(241,234,216,.85)' }}>
                  ReFeed is a quiet little exchange between the kitchens that
                  finish service and the farmers that begin the day&apos;s feed.
                  No middlemen. No landfills. Just <span className="italic font-instrument" style={{ color: 'var(--rf-sap)' }}>returns.</span>
                </p>

                <div className="mt-10 flex flex-wrap items-center gap-5">
                  <button
                    onClick={handleGetStarted}
                    className="group relative inline-flex items-center gap-4 pl-7 pr-2 py-2 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 rf-glow-sap"
                    style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}
                  >
                    <span>Begin the loop</span>
                    <span className="flex items-center justify-center size-10 rounded-full transition-transform group-hover:rotate-45"
                          style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>

                  <Link
                    href="#manifesto"
                    className="font-mono-jb text-[11px] uppercase tracking-[0.25em] rf-dashed-rule pb-1 opacity-80 hover:opacity-100 hover:text-[color:var(--rf-sap)] transition-colors"
                  >
                    Read the field notes ↓
                  </Link>
                </div>
              </div>

              {/* Side block: rotating seal + stats */}
              <aside className="col-span-12 md:col-span-5 lg:col-span-6 md:pl-8 mt-8 md:mt-0 rf-fade-up"
                     style={{ animationDelay: '.55s' }}>
                <div className="grid grid-cols-2 gap-x-6 gap-y-8">

                  {/* Rotating seal */}
                  <div className="col-span-2 md:col-span-1 flex md:justify-start">
                    <div className="relative size-36 md:size-40">
                      <svg className="rf-spin-slow absolute inset-0" viewBox="0 0 200 200">
                        <defs>
                          <path id="seal" d="M 100, 100 m -78, 0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0" />
                        </defs>
                        <text className="font-mono-jb" fontSize="11" letterSpacing="6"
                              fill="var(--rf-bone)" style={{ opacity: 0.7 }}>
                          <textPath href="#seal">
                            FROM · KITCHEN · TO · FIELD · ↻ · FROM · FIELD · TO · TABLE · ↻ ·
                          </textPath>
                        </text>
                      </svg>
                      <div className="absolute inset-6 rounded-full flex items-center justify-center border"
                           style={{ borderColor: 'rgba(200,255,77,.3)', borderStyle: 'dashed' }}>
                        <div className="text-center leading-none">
                          <div className="font-fraunces fraunces-wonk italic text-3xl"
                               style={{ color: 'var(--rf-sap)' }}>est.</div>
                          <div className="font-mono-jb text-[10px] tracking-[0.3em] mt-1 opacity-70">2024</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="col-span-2 md:col-span-1 space-y-6">
                    <Stat n="2,481" unit="kg" label="rescued this week" />
                    <Stat n="407" unit="" label="farmers in the field" />
                    <Stat n="17" unit="cities" label="and quietly growing" />
                  </div>

                </div>
              </aside>
            </div>

            {/* Footnote row */}
            <div className="mt-24 grid grid-cols-12 gap-6 items-start rf-fade-up" style={{ animationDelay: '.7s' }}>
              <div className="col-span-12 md:col-span-3 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50">
                §  Footnote
              </div>
              <p className="col-span-12 md:col-span-6 font-instrument italic text-lg leading-snug"
                 style={{ color: 'rgba(241,234,216,.7)' }}>
                &ldquo;The most radical thing a kitchen can do today is finish
                the meal — and then begin the soil.&rdquo;
              </p>
              <div className="col-span-12 md:col-span-3 md:text-right font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50">
                — A farmer, somewhere upstate
              </div>
            </div>
          </div>
        </section>

        {/* MARQUEE STRIP */}
        <section className="relative border-y overflow-hidden py-6"
                 style={{ borderColor: 'rgba(241,234,216,.12)', background: 'var(--rf-moss)' }}>
          <div className="flex whitespace-nowrap rf-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span
                key={i}
                className="font-fraunces fraunces-wonk italic text-3xl md:text-4xl px-10 flex items-center gap-10"
                style={{ color: i % 2 ? 'var(--rf-bone)' : 'var(--rf-sap)' }}
              >
                {item}
                <span className="opacity-30" style={{ color: 'var(--rf-bone)' }}>✦</span>
              </span>
            ))}
          </div>
        </section>

        {/* THREE-COLUMN ALMANAC */}
        <section id="manifesto" className="relative px-6 md:px-16 lg:px-24 py-24">
          <div className="max-w-7xl mx-auto">

            <div className="flex flex-wrap items-end justify-between mb-14 gap-4">
              <div>
                <div className="font-mono-jb text-[10px] uppercase tracking-[0.35em] opacity-60 mb-3">
                  Chapter 01 · How the loop closes
                </div>
                <h2 className="font-fraunces fraunces-wonk text-5xl md:text-6xl font-light tracking-[-0.03em] leading-[0.95]"
                    style={{ color: 'var(--rf-bone)' }}>
                  Three <span className="italic font-instrument" style={{ color: 'var(--rf-sap)' }}>simple</span> motions.
                </h2>
              </div>
              <div className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50 hidden md:block">
                pp. 04 — 06
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card
                num="01"
                title="List the surplus"
                body="A kitchen logs what didn't sell. A bakery weighs the day's overs. Two taps, one photo, and it's offered to the network."
                icon="restaurant"
              />
              <Card
                num="02"
                title="A farmer claims"
                body="Local growers see what's available within their orbit, claim a parcel, and schedule the pickup. No haggling, no spoilage."
                icon="agriculture"
              />
              <Card
                num="03"
                title="The loop closes"
                body="Yesterday's scraps become today's feed, tomorrow's compost, and next season's harvest. Rated, returned, and renewed."
                icon="cycle"
              />
            </div>
          </div>
        </section>

        {/* CTA FOOTER BAND */}
        <section className="relative px-6 md:px-16 lg:px-24 pb-24">
          <div className="max-w-7xl mx-auto">
            <div className="relative rounded-3xl p-10 md:p-16 overflow-hidden border"
                 style={{ background: 'var(--rf-sap)', borderColor: 'var(--rf-sap-deep)' }}>
              <div className="absolute -right-10 -bottom-10 size-80 rounded-full"
                   style={{ background: 'var(--rf-sap-deep)', opacity: .35 }} />
              <div className="relative grid grid-cols-12 gap-8 items-center">
                <div className="col-span-12 md:col-span-8">
                  <div className="font-mono-jb text-[10px] uppercase tracking-[0.35em] mb-4"
                       style={{ color: 'var(--rf-forest)' }}>
                    ✺  An open invitation
                  </div>
                  <h3 className="font-fraunces fraunces-wonk text-4xl md:text-6xl font-light leading-[0.95] tracking-[-0.03em]"
                      style={{ color: 'var(--rf-forest)' }}>
                    Bring your kitchen.
                    <br />
                    <span className="italic font-instrument">Bring your field.</span>
                  </h3>
                </div>
                <div className="col-span-12 md:col-span-4 flex md:justify-end">
                  <button
                    onClick={handleGetStarted}
                    className="group inline-flex items-center gap-4 pl-7 pr-2 py-2 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5"
                    style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}
                  >
                    <span>Get started</span>
                    <span className="flex items-center justify-center size-10 rounded-full transition-transform group-hover:rotate-45"
                          style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="relative px-6 md:px-16 lg:px-24 py-10 border-t"
                style={{ borderColor: 'rgba(241,234,216,.12)' }}>
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <p className="font-instrument italic text-lg" style={{ color: 'rgba(241,234,216,.6)' }}>
              ReFeed — quietly closing the loop, one supper at a time.
            </p>
            <div className="flex gap-8 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60">
              <Link href="#help" className="hover:text-[color:var(--rf-sap)] transition-colors">Help</Link>
              <Link href="#status" className="hover:text-[color:var(--rf-sap)] transition-colors">Status</Link>
              <Link href="#privacy" className="hover:text-[color:var(--rf-sap)] transition-colors">Privacy</Link>
              <span className="opacity-60">© {new Date().getFullYear()}  CodeCraft Tech</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ——— sub-components ——— */
function Stat({ n, unit, label }: { n: string; unit?: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b pb-3"
         style={{ borderColor: 'rgba(241,234,216,.12)' }}>
      <span className="font-fraunces fraunces-wonk text-5xl md:text-6xl font-light leading-none tracking-[-0.04em]"
            style={{ color: 'var(--rf-bone)' }}>
        {n}
      </span>
      {unit && (
        <span className="font-instrument italic text-xl"
              style={{ color: 'var(--rf-sap)' }}>
          {unit}
        </span>
      )}
      <span className="font-mono-jb text-[10px] uppercase tracking-[0.25em] ml-auto opacity-60 text-right max-w-[120px]">
        {label}
      </span>
    </div>
  );
}

function Card({ num, title, body, icon }: { num: string; title: string; body: string; icon: string }) {
  return (
    <article
      className="group relative p-8 rounded-2xl border transition-all hover:-translate-y-1 hover:bg-white/[0.02]"
      style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.02)' }}
    >
      <div className="flex items-start justify-between mb-10">
        <span className="font-fraunces fraunces-wonk italic text-7xl font-light leading-none"
              style={{ color: 'var(--rf-sap)' }}>
          {num}
        </span>
        <span className="material-symbols-outlined opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--rf-bone)', fontSize: 28 }}>
          {icon}
        </span>
      </div>
      <h3 className="font-fraunces text-2xl font-medium leading-tight tracking-tight mb-3"
          style={{ color: 'var(--rf-bone)' }}>
        {title}
      </h3>
      <p className="font-fraunces text-base leading-relaxed"
         style={{ color: 'rgba(241,234,216,.7)' }}>
        {body}
      </p>
      <div className="absolute bottom-6 right-6 size-8 rounded-full flex items-center justify-center
                      opacity-0 group-hover:opacity-100 transition-opacity"
           style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </article>
  );
}
