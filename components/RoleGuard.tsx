'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, onAuthStateChange } from '@/lib/firebase';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (currentUser) => {
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

    return () => unsubscribe();
  }, [router, allowedRoles]);

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

