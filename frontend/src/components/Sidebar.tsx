'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { clsx } from 'clsx';
import {
  Shield, LayoutDashboard, Database, MessageSquare, Search,
  Upload, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/knowledge-bases', label: 'Knowledge Bases', icon: Database },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare },
  { href: '/dashboard/search', label: 'Search', icon: Search },
  { href: '/dashboard/ingestion', label: 'Ingestion', icon: Upload },
  { href: '/dashboard/evaluation', label: 'Evaluation', icon: BarChart3 },
  { href: '/dashboard/chunking', label: 'Chunking Preview', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, sidebarOpen, toggleSidebar, logout } = useAppStore();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-200 z-30',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-vault-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && <span className="font-bold text-gray-900">VaultRAG</span>}
        </div>
        <button
          onClick={toggleSidebar}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-vault-50 text-vault-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 p-4">
        {sidebarOpen && user && (
          <div className="text-sm text-gray-600 mb-2 truncate">{user.email}</div>
        )}
        <button
          onClick={() => { logout(); window.location.href = '/login'; }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
