import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
export function LoginPage({
  onNavigateToSignup


}: {onNavigateToSignup: () => void;}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((state) => state.login);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      // Mock login - extracting name from email for demo
      const name = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ') || 'User';
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      login(email, capitalizedName);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-8">
        
        <div className="flex justify-center mb-8">
          <div className="bg-indigo-600 p-3 rounded-xl">
            <MessageSquare className="text-white" size={32} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
          Welcome back
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Sign in to continue to Support AI
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="you@company.com" />
            
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="••••••••" />
            
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors">
            
            Sign In
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Don't have an account?{' '}
          <button
            onClick={onNavigateToSignup}
            className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline focus:outline-none">
            
            Sign up
          </button>
        </div>
      </motion.div>
    </div>);

}