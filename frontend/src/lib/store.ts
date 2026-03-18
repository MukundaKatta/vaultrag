import { create } from 'zustand';
import type { User, KnowledgeBase } from './types';

interface AppState {
  user: User | null;
  token: string | null;
  currentKB: KnowledgeBase | null;
  sidebarOpen: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setCurrentKB: (kb: KnowledgeBase | null) => void;
  toggleSidebar: () => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  currentKB: null,
  sidebarOpen: true,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('vaultrag_token', token);
    } else {
      localStorage.removeItem('vaultrag_token');
    }
    set({ token });
  },
  setCurrentKB: (kb) => set({ currentKB: kb }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  logout: () => {
    localStorage.removeItem('vaultrag_token');
    localStorage.removeItem('vaultrag_user');
    set({ user: null, token: null, currentKB: null });
  },
}));
