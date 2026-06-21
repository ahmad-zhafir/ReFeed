'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange } from '@/lib/firebase';
import { User } from 'firebase/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChange((currentUser) => {
        setUser(currentUser);
        setLoading(false);
        
        if (!currentUser) {
          router.push('/login');
        }
      });
    } catch (err) {
      console.error('AuthGuard auth initialization failed:', err);
      setError('Authentication could not initialize. Check your Firebase config and restart the dev server.');
      setLoading(false);
    }

    return () => unsubscribe();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--rf-forest)', color: 'var(--rf-bone)' }}>
        <div className="max-w-xl rounded-2xl border p-6" style={{ borderColor: 'rgba(241,234,216,.14)', background: 'rgba(241,234,216,.025)' }}>
          <p className="font-mono-jb text-[10px] uppercase tracking-[0.25em] opacity-60 mb-3">Auth error</p>
          <h2 className="font-fraunces text-2xl font-medium mb-2">{error}</h2>
          <p className="font-instrument italic text-lg" style={{ color: 'rgba(241,234,216,.7)' }}>
            If you already added the Firebase values, stop and restart npm run dev so Next can pick up the new .env.local values.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}

