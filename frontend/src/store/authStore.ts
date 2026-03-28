import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, name?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      login: (email, name = 'Demo User') =>
      set({
        isAuthenticated: true,
        user: {
          id: Math.random().toString(36).substring(7),
          name,
          email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`
        }
      }),
      logout: () => set({ isAuthenticated: false, user: null })
    }),
    {
      name: 'auth-storage'
    }
  )
);