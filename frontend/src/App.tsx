import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { LoginPage } from './components/auth/LoginPage';
import { SignupPage } from './components/auth/SignupPage';
import { AppLayout } from './components/layout/AppLayout';
export function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isDark = useThemeStore((state) => state.isDark);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  // Ensure theme is applied on initial load
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);
  if (!isAuthenticated) {
    return authView === 'login' ?
    <LoginPage onNavigateToSignup={() => setAuthView('signup')} /> :

    <SignupPage onNavigateToLogin={() => setAuthView('login')} />;

  }
  return <AppLayout />;
}