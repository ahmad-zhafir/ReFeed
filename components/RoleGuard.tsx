'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChange } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { getUserProfile } from '@/lib/userProfile';
import { MarketplaceRole } from '@/lib/types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: MarketplaceRole[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<MarketplaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChange(async (currentUser) => {
        setUser(currentUser);
        
        if (!currentUser) {
          router.push('/login');
          setLoading(false);
          return;
        }

        // Get user profile to check role
        const profile = await getUserProfile(currentUser.uid);
        
        if (!profile || !profile.role) {
          // No role set, redirect to onboarding
          router.push('/onboarding/role');
          setLoading(false);
          return;
        }

        const role = profile.role as MarketplaceRole;
        setUserRole(role);

        // Check if user's role is allowed
        if (!allowedRoles.includes(role)) {
          // Redirect to their role's home page
          if (role === 'generator') {
            router.push('/generator');
          } else if (role === 'farmer') {
            router.push('/farmer');
          } else {
            router.push('/onboarding/role');
          }
          setLoading(false);
          return;
        }

        setLoading(false);
      });
    } catch (err) {
      console.error('RoleGuard auth initialization failed:', err);
      setError('Authentication could not initialize. Check your Firebase config and restart the dev server.');
      setLoading(false);
    }

    return () => unsubscribe();
  }, [router, allowedRoles]);

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

  if (!user || !userRole || !allowedRoles.includes(userRole)) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

