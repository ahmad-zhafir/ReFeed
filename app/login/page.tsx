'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUpWithEmail, signInWithEmail, getFirestoreDb } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { MarketplaceRole } from '@/lib/types';
import { getUserProfile } from '@/lib/userProfile';
import Link from 'next/link';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [selectedRole, setSelectedRole] = useState<MarketplaceRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name || !contact) { setError('Name and contact number are required'); setLoading(false); return; }
        if (!selectedRole) { setError('Please select your role (Generator or Farmer)'); setLoading(false); return; }

        const userCredential = await signUpWithEmail(email, password);
        const user = userCredential.user;

        const db = getFirestoreDb();
        const userProfile: any = {
          id: user.uid, email: user.email || email,
          name, contact, role: selectedRole, created_at: new Date(),
        };
        Object.keys(userProfile).forEach((k) => userProfile[k] === undefined && delete userProfile[k]);
        await setDoc(doc(db, 'users', user.uid), userProfile);
        router.push('/onboarding/location');
      } else {
        const userCredential = await signInWithEmail(email, password);
        const profile = await getUserProfile(userCredential.user.uid);
        if (!profile || !profile.role) router.push('/onboarding/role');
        else if (profile.role === 'generator') router.push('/generator');
        else if (profile.role === 'farmer') router.push('/farmer');
        else router.push(redirectTo);
      }
    } catch (error: any) {
      let m = 'An error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') m = 'This email is already registered. Please sign in instead.';
      else if (error.code === 'auth/weak-password') m = 'Password should be at least 6 characters.';
      else if (error.code === 'auth/invalid-email') m = 'Invalid email address.';
      else if (error.code === 'auth/user-not-found') m = 'No account found with this email. Please sign up first.';
      else if (error.code === 'auth/wrong-password') m = 'Incorrect password.';
      else if (error.message) m = error.message;
      setError(m);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-fraunces antialiased min-h-screen flex relative overflow-hidden"
         style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>

      {/* Atmospheric overlays */}
      <div className="pointer-events-none absolute inset-0 rf-dotgrid opacity-50" />
      <div className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 600px at 10% 90%, rgba(200,255,77,.10), transparent 60%), radial-gradient(700px 500px at 100% 0%, rgba(217,87,42,.10), transparent 60%)',
        }} />
      <div className="pointer-events-none absolute inset-0 rf-vignette" />

      {/* —— LEFT: Editorial poster panel —— */}
      <aside className="hidden lg:flex flex-col justify-between w-[44%] relative px-12 py-10 border-r"
             style={{ borderColor: 'rgba(241,234,216,.10)' }}>
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative size-10">
            <Image src="/images/logo.svg" alt="ReFeed logo" fill sizes="40px" priority className="object-contain" />
          </div>
          <div className="flex flex-col leading-none">
            <h2 className="font-fraunces fraunces-wonk text-2xl font-black tracking-[-0.03em]">
              Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
            </h2>
            <span className="font-mono-jb text-[9px] uppercase tracking-[0.32em] mt-1 opacity-60">
              Circular · Local · Living
            </span>
          </div>
        </Link>

        <div>
          <div className="rf-eyebrow mb-6 flex items-center gap-3">
            <span className="size-1.5 rounded-full" style={{ background: 'var(--rf-sap)' }} />
            Issue №001 · The Returning
          </div>
          <h1 className="rf-headline text-[clamp(3rem,5vw,5.5rem)] mb-8">
            Welcome
            <br />
            <span className="italic">back to the</span>
            <br />
            loop.
          </h1>
          <p className="font-instrument italic text-2xl leading-snug max-w-md"
             style={{ color: 'rgba(241,234,216,.7)' }}>
            A quiet little exchange between yesterday&apos;s kitchens and tomorrow&apos;s fields.
          </p>

          <div className="mt-12 relative size-32">
            <svg className="rf-spin-slow absolute inset-0" viewBox="0 0 200 200">
              <defs>
                <path id="seal-login" d="M 100, 100 m -78, 0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0" />
              </defs>
              <text className="font-mono-jb" fontSize="11" letterSpacing="6" fill="var(--rf-bone)" style={{ opacity: 0.7 }}>
                <textPath href="#seal-login">
                  FROM · KITCHEN · TO · FIELD · ↻ · FROM · FIELD · TO · TABLE · ↻ ·
                </textPath>
              </text>
            </svg>
            <div className="absolute inset-6 rounded-full flex items-center justify-center border border-dashed"
                 style={{ borderColor: 'rgba(200,255,77,.3)' }}>
              <span className="font-fraunces fraunces-wonk italic text-2xl" style={{ color: 'var(--rf-sap)' }}>est.</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50">
          <span>An almanac of returns</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </aside>

      {/* —— RIGHT: Form column —— */}
      <main className="relative z-10 flex-1 flex items-start lg:items-center justify-center px-6 py-16 lg:py-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden flex items-center gap-3 mb-10">
            <div className="relative size-9">
              <Image src="/images/logo.svg" alt="ReFeed logo" fill sizes="36px" priority className="object-contain" />
            </div>
            <h2 className="font-fraunces fraunces-wonk text-2xl font-black tracking-[-0.03em]">
              Re<span className="italic font-light" style={{ color: 'var(--rf-sap)' }}>Feed</span>
            </h2>
          </Link>

          <div className="inline-flex p-1 rounded-full mb-10 border"
               style={{ borderColor: 'rgba(241,234,216,.12)', background: 'rgba(241,234,216,.03)' }}>
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); }}
              className="px-5 py-2 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.28em] transition-all"
              style={!isSignUp
                ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
                : { color: 'var(--rf-bone)', opacity: 0.55 }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(''); setSelectedRole(null); }}
              className="px-5 py-2 rounded-full font-mono-jb text-[10px] uppercase tracking-[0.28em] transition-all"
              style={isSignUp
                ? { background: 'var(--rf-sap)', color: 'var(--rf-forest)' }
                : { color: 'var(--rf-bone)', opacity: 0.55 }}
            >
              New Here
            </button>
          </div>

          <div className="mb-2 rf-eyebrow">
            {isSignUp ? '› Begin your apprenticeship' : '› Return to the loop'}
          </div>
          <h1 className="rf-headline text-5xl md:text-6xl mb-3">
            {isSignUp ? (
              <>Pull up a <span className="italic">chair.</span></>
            ) : (
              <>Welcome <span className="italic">back.</span></>
            )}
          </h1>
          <p className="font-instrument italic text-lg mb-10" style={{ color: 'rgba(241,234,216,.65)' }}>
            {isSignUp
              ? 'A few notes about you, and we\'ll set your seat.'
              : 'The kitchens are warm. Let\'s begin.'}
          </p>

          {error && (
            <div className="mb-6 px-5 py-4 rounded-xl border font-mono-jb text-[11px] uppercase tracking-[0.18em]"
                 style={{ background: 'rgba(217,87,42,.08)', borderColor: 'rgba(217,87,42,.35)', color: 'var(--rf-rust)' }}>
              ⚠  {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <>
                <Field label="Full name" hint="01">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                    className="rf-input w-full h-12 px-4" placeholder="Jane Harvest" />
                </Field>

                <Field label="Contact number" hint="02">
                  <input type="tel" value={contact} onChange={(e) => setContact(e.target.value)} required
                    className="rf-input w-full h-12 px-4" placeholder="+1 (000) 000 0000" />
                </Field>

                <div>
                  <div className="flex items-end justify-between mb-3">
                    <label className="font-fraunces text-base font-medium" style={{ color: 'var(--rf-bone)' }}>
                      I am a…
                    </label>
                    <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50">03</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <RolePill icon="restaurant" label="Restaurant" sub="surplus →"
                      selected={selectedRole === 'generator'} onClick={() => setSelectedRole('generator')} />
                    <RolePill icon="agriculture" label="Farmer" sub="← receives"
                      selected={selectedRole === 'farmer'} onClick={() => setSelectedRole('farmer')} />
                  </div>
                </div>
              </>
            )}

            <Field label="Email address" hint={isSignUp ? '04' : '01'}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="rf-input w-full h-12 px-4" placeholder="you@kitchen.farm" />
            </Field>

            <Field
              label="Password"
              hint={isSignUp ? '05' : '02'}
              right={!isSignUp && (
                <a href="#" className="font-mono-jb text-[10px] uppercase tracking-[0.25em] hover:underline"
                   style={{ color: 'var(--rf-sap)' }}>
                  Forgot it?
                </a>
              )}
            >
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  className="rf-input w-full h-12 px-4 pr-12" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-4 flex items-center opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </Field>

            <button type="submit" disabled={loading}
              className="group mt-8 w-full inline-flex items-center justify-between pl-7 pr-2 h-14 rounded-full font-mono-jb text-[12px] uppercase tracking-[0.25em] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed rf-glow-sap"
              style={{ background: 'var(--rf-sap)', color: 'var(--rf-forest)' }}>
              <span>{loading ? 'Working the soil…' : isSignUp ? 'Begin the loop' : 'Step inside'}</span>
              <span className="flex items-center justify-center size-11 rounded-full transition-transform group-hover:rotate-45"
                    style={{ background: 'var(--rf-forest)', color: 'var(--rf-sap)' }}>
                {loading ? (
                  <span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>

            <p className="text-center font-instrument italic text-base mt-6"
               style={{ color: 'rgba(241,234,216,.6)' }}>
              {isSignUp ? 'Already part of the harvest? ' : 'New to the table? '}
              <button type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setSelectedRole(null); }}
                className="not-italic font-mono-jb text-[10px] uppercase tracking-[0.25em] ml-1 underline underline-offset-4 hover:no-underline"
                style={{ color: 'var(--rf-sap)' }}>
                {isSignUp ? 'Sign in' : 'Pull up a chair'}
              </button>
            </p>
          </form>

          <div className="mt-12 pt-6 border-t flex flex-wrap justify-between gap-4 font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-60"
               style={{ borderColor: 'rgba(241,234,216,.10)' }}>
            <span>
              By {isSignUp ? 'signing up' : 'signing in'}, you agree to our{' '}
              <a href="#" className="hover:text-[color:var(--rf-sap)] underline underline-offset-4">Terms</a> &{' '}
              <a href="#" className="hover:text-[color:var(--rf-sap)] underline underline-offset-4">Privacy</a>.
            </span>
            <Link href="/" className="hover:text-[color:var(--rf-sap)]">← Back to almanac</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label, hint, right, children,
}: { label: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-end justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <span className="font-fraunces text-base font-medium" style={{ color: 'var(--rf-bone)' }}>{label}</span>
          {hint && <span className="font-mono-jb text-[10px] uppercase tracking-[0.3em] opacity-50">{hint}</span>}
        </div>
        {right}
      </div>
      {children}
    </label>
  );
}

function RolePill({
  icon, label, sub, selected, onClick,
}: { icon: string; label: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group relative p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5"
      style={{
        borderColor: selected ? 'var(--rf-sap)' : 'rgba(241,234,216,.16)',
        background: selected ? 'rgba(200,255,77,.06)' : 'rgba(241,234,216,.02)',
      }}>
      <div className="flex items-center justify-between mb-2">
        <span className="material-symbols-outlined" style={{ color: selected ? 'var(--rf-sap)' : 'var(--rf-bone)', fontSize: 24 }}>
          {icon}
        </span>
        {selected && <span className="size-2 rounded-full" style={{ background: 'var(--rf-sap)' }} />}
      </div>
      <p className="font-fraunces fraunces-wonk text-xl font-medium" style={{ color: 'var(--rf-bone)' }}>{label}</p>
      <p className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 mt-1">{sub}</p>
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--rf-forest)' }}>
        <p className="font-instrument italic text-2xl" style={{ color: 'var(--rf-bone)' }}>
          unlocking the gate<span className="animate-pulse">…</span>
        </p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
