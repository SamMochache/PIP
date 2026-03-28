import React from 'react';
import { motion } from 'framer-motion';
export function TypingIndicator() {
  const dotVariants = {
    initial: {
      y: 0
    },
    animate: {
      y: -4
    }
  };
  const transition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: 'reverse' as const,
    ease: 'easeInOut'
  };
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 h-6">
      <motion.div
        className="w-1.5 h-1.5 bg-gray-400 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{
          ...transition,
          delay: 0
        }} />
      
      <motion.div
        className="w-1.5 h-1.5 bg-gray-400 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{
          ...transition,
          delay: 0.15
        }} />
      
      <motion.div
        className="w-1.5 h-1.5 bg-gray-400 rounded-full"
        variants={dotVariants}
        initial="initial"
        animate="animate"
        transition={{
          ...transition,
          delay: 0.3
        }} />
      
    </div>);

}