import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { motion } from 'framer-motion';
export function ThemeToggle() {
  const { isDark, toggleTheme } = useThemeStore();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      aria-label="Toggle dark mode">
      
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 180 : 0
        }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut'
        }}>
        
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </motion.div>
    </button>);

}