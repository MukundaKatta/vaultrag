'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { token } = useAppStore();

  useEffect(() => {
    const saved = localStorage.getItem('vaultrag_token');
    if (saved) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router, token]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-vault-600 text-xl font-semibold">Loading VaultRAG...</div>
    </div>
  );
}
