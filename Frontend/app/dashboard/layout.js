'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function DashboardLayout({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.replace('/sign-in'); return; }
    if (user && user.role === 'student') { router.replace('/student-dashboard'); }
  }, [loading, isAuthenticated, user, router]);

  if (loading || !isAuthenticated) return null;
  if (user && user.role === 'student') return null;

  return <>{children}</>;
}
