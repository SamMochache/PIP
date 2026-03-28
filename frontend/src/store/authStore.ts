import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  authApi,
  setStoredTokens,
  removeStoredTokens,
  getStoredTokens,
} from "../services/api";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function avatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user, tokens } = await authApi.login(email, password);
          setStoredTokens(tokens);
          const name = user.username;
          set({
            isAuthenticated: true,
            user: {
              id: String(user.id),
              name,
              email: user.email,
              avatar: user.avatar_url || avatarUrl(name),
            },
            isLoading: false,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Login failed";
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        // username: lowercase, spaces → underscores
        const username = name.toLowerCase().replace(/\s+/g, "_");
        try {
          const { user, tokens } = await authApi.register(
            username,
            email,
            password,
            password
          );
          setStoredTokens(tokens);
          set({
            isAuthenticated: true,
            user: {
              id: String(user.id),
              name,
              email: user.email,
              avatar: user.avatar_url || avatarUrl(name),
            },
            isLoading: false,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Registration failed";
          set({ isLoading: false, error: message });
          throw err;
        }
      },

      logout: () => {
        removeStoredTokens();
        set({ isAuthenticated: false, user: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      // Only persist user info — tokens live under their own key (TOKEN_KEY in api.ts)
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        // If persisted as authenticated but tokens are gone, reset
        if (state?.isAuthenticated && !getStoredTokens()) {
          state.isAuthenticated = false;
          state.user = null;
        }
      },
    }
  )
);
