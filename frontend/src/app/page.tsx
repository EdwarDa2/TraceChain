'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../providers/auth-provider';

export default function Home() {
  const { token } = useAuth();
  const router = useRouter();
  useEffect(() => {
    router.replace(token ? '/dashboard' : '/login');
  }, [token, router]);
  return null;
}
