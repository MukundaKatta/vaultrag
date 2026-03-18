'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import { clsx } from 'clsx';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser, setToken, sidebarOpen } = useAppStore();

  useEffect(() => {
    const token = localStorage.getItem('vaultrag_token');
    const savedUser = localStorage.getItem('vaultrag_user');
    if (!token) {
      router.push('/login');
      return;
    }
    setToken(token);
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }
  }, [router, setUser, setToken]);

  if (!user && typeof window !== 'undefined' && !localStorage.getItem('vaultrag_token')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className={clsx('transition-all duration-200', sidebarOpen ? 'ml-64' : 'ml-16')}>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
