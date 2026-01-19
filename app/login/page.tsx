'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signUpWithEmail, signInWithEmail, getFirestoreDb, onAuthStateChange } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { UserProfile, MarketplaceRole } from '@/lib/types';
import { getUserProfile, setUserRoleOnce } from '@/lib/userProfile';
import Link from 'next/link';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign up
        if (!name || !contact) {
          setError('Name and contact number are required');
          setLoading(false);
          return;
        }

        if (!selectedRole) {
          setError('Please select your role (Generator or Farmer)');
          setLoading(false);
          return;
        }

        const userCredential = await signUpWithEmail(email, password);
        const user = userCredential.user;

        // Create user profile with role
        const db = getFirestoreDb();
        const userProfile: any = {
          id: user.uid,
          email: user.email || email,
          name,
          contact,
          role: selectedRole,
          created_at: new Date(),
        };
        
        // Remove any undefined values
        Object.keys(userProfile).forEach(key => {
          if (userProfile[key] === undefined) {
            delete userProfile[key];
          }
        });

        await setDoc(doc(db, 'users', user.uid), userProfile);

        // Redirect to location onboarding (role already set)
        router.push('/onboarding/location');
      } else {
        // Sign in
        const userCredential = await signInWithEmail(email, password);
        
        // Check if user has role set, redirect accordingly
        const profile = await getUserProfile(userCredential.user.uid);
        if (!profile || !profile.role) {
          router.push('/onboarding/role');
        } else {
          const role = profile.role as MarketplaceRole;
          if (role === 'generator') {
            router.push('/generator');
          } else if (role === 'farmer') {
            router.push('/farmer');
          } else {
            router.push(redirectTo);
          }
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMessage = 'An error occurred. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f6f8f6] dark:bg-[#102213] text-slate-900 dark:text-white font-display antialiased overflow-x-hidden flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-solid border-gray-200 dark:border-[#234829] bg-white/80 dark:bg-[#102213]/80 backdrop-blur-md">
        <div className="px-6 md:px-10 py-3 flex items-center justify-between mx-auto max-w-7xl">
          <Link href="/" className="flex items-center gap-4 text-slate-900 dark:text-white cursor-pointer">
            <div className="size-8 text-[#13ec37]">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" fill="currentColor"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">ReFeed</h2>
          </Link>

          <nav className="hidden md:flex flex-1 justify-end gap-8 items-center">
            <div className="flex items-center gap-8">
              <Link href="#about" className="text-slate-600 dark:text-white hover:text-[#13ec37] dark:hover:text-[#13ec37] transition-colors text-sm font-medium leading-normal">
                About
              </Link>
              <Link href="#impact" className="text-slate-600 dark:text-white hover:text-[#13ec37] dark:hover:text-[#13ec37] transition-colors text-sm font-medium leading-normal">
                Impact
              </Link>
              <Link href="#partners" className="text-slate-600 dark:text-white hover:text-[#13ec37] dark:hover:text-[#13ec37] transition-colors text-sm font-medium leading-normal">
                Partners
              </Link>
            </div>
          </nav>

          <div className="md:hidden text-slate-900 dark:text-white">
            <span className="material-symbols-outlined">menu</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col relative items-center justify-center p-4 py-10">
        {/* Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center transform scale-105" 
            style={{
              backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-UfDZUpEAXAScgAFdJ6Ivt_P8n3HDc1Fibv9mqgnRJC010Fpz4a7_ZoZnCKe50bjaGb4nKIs9Xmpa7L0Q3xlZkPPlK7qiG_63z6OTag0dRGrzXea-FkqFFkE7-x0g60wu5rPhigtDIRhk1QEuSF128Ns2ahjAhuJEvlHXtArd4IqGknv39Kn0dTe_UOfNks0cGA4XMA1Fe4u-sT7z-dFV5hpaJ-2azacOO3MU2jeB9W7u_fTwxVecXUjZXUQ80cc1GBqcBvaimdY")',
              filter: 'blur(8px)'
            }}
          ></div>
          <div className="absolute inset-0 bg-[#102213]/85 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-black/30"></div>
        </div>

        {/* Form Card */}
        <div className="relative z-10 w-full max-w-[580px] flex flex-col gap-6">
          <div className="bg-white dark:bg-[#19331e] rounded-xl shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-white/10 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-white/10">
              <button
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
                  !isSignUp
                    ? 'text-[#13ec37] border-b-2 border-[#13ec37] bg-[#13ec37]/5'
                    : 'text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                  setSelectedRole(null);
                }}
                className={`flex-1 py-4 text-sm font-bold text-center transition-colors ${
                  isSignUp
                    ? 'text-[#13ec37] border-b-2 border-[#13ec37] bg-[#13ec37]/5'
                    : 'text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 md:p-10 flex flex-col gap-8">
              {/* Welcome Message */}
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-slate-500 dark:text-[#92c99b] mt-1">
                  {isSignUp ? 'Start your journey towards zero waste.' : 'Continue your journey towards zero waste.'}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {isSignUp && (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-white">Full Name</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={isSignUp}
                        className="mt-1 block w-full rounded-lg border-gray-300 dark:border-none bg-white dark:bg-[#234829] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92c99b] focus:border-[#13ec37] focus:ring-[#13ec37] focus:ring-1 sm:text-sm h-12 px-4 shadow-sm"
                        placeholder="John Doe"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-white">Contact Number</span>
                      <input
                        type="tel"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        required={isSignUp}
                        className="mt-1 block w-full rounded-lg border-gray-300 dark:border-none bg-white dark:bg-[#234829] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92c99b] focus:border-[#13ec37] focus:ring-[#13ec37] focus:ring-1 sm:text-sm h-12 px-4 shadow-sm"
                        placeholder="+1234567890"
                      />
                    </label>

                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-white block mb-2">I am a... *</span>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedRole('generator')}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedRole === 'generator'
                              ? 'border-[#13ec37] bg-[#13ec37]/10 dark:bg-[#13ec37]/20'
                              : 'border-gray-300 dark:border-white/10 hover:border-[#13ec37]/50'
                          }`}
                        >
                          <p className="font-semibold text-slate-900 dark:text-white">Restaurant / Generator</p>
                          <p className="text-xs text-slate-500 dark:text-[#92c99b] mt-1">Sell waste feed</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRole('farmer')}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedRole === 'farmer'
                              ? 'border-[#13ec37] bg-[#13ec37]/10 dark:bg-[#13ec37]/20'
                              : 'border-gray-300 dark:border-white/10 hover:border-[#13ec37]/50'
                          }`}
                        >
                          <p className="font-semibold text-slate-900 dark:text-white">Farmer / Receiver</p>
                          <p className="text-xs text-slate-500 dark:text-[#92c99b] mt-1">Buy waste feed</p>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <label className="block">
                  <span className="text-sm font-medium text-slate-700 dark:text-white">Email address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-lg border-gray-300 dark:border-none bg-white dark:bg-[#234829] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92c99b] focus:border-[#13ec37] focus:ring-[#13ec37] focus:ring-1 sm:text-sm h-12 px-4 shadow-sm"
                    placeholder="you@company.com"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-white">Password</span>
                    {!isSignUp && (
                      <a href="#" className="text-xs text-[#13ec37] hover:text-[#0fd630] font-medium">
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="block w-full rounded-lg border-gray-300 dark:border-none bg-white dark:bg-[#234829] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#92c99b] focus:border-[#13ec37] focus:ring-[#13ec37] focus:ring-1 sm:text-sm h-12 px-4 shadow-sm"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </label>

                <div className="flex flex-col gap-4 mt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-[#13ec37] hover:bg-[#0fd630] text-[#102213] text-base font-bold leading-normal tracking-[0.015em] transition-colors shadow-[0_0_15px_rgba(19,236,55,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
                  </button>

                  <p className="text-center text-sm text-slate-500 dark:text-[#92c99b]">
                    {isSignUp ? "Already have an account? " : "Don't have an account? "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError('');
                        setSelectedRole(null);
                      }}
                      className="font-semibold text-[#13ec37] hover:underline"
                    >
                      {isSignUp ? 'Sign in' : 'Sign up'}
                    </button>
                  </p>
                </div>
              </form>
            </div>

            {/* Terms Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-[#112214] border-t border-gray-200 dark:border-white/5 flex justify-center">
              <p className="text-xs text-slate-400 dark:text-gray-500 text-center">
                By signing {isSignUp ? 'up' : 'in'}, you agree to our{' '}
                <a href="#" className="underline hover:text-[#13ec37]">Terms</a> and{' '}
                <a href="#" className="underline hover:text-[#13ec37]">Privacy Policy</a>.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="flex justify-center gap-6 text-xs font-medium text-white/60">
            <Link href="#" className="hover:text-[#13ec37] transition-colors">Help Center</Link>
            <Link href="#" className="hover:text-[#13ec37] transition-colors">Platform Status</Link>
            <Link href="#" className="hover:text-[#13ec37] transition-colors">Contact Support</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#102213] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#13ec37] mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
