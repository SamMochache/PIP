import React from 'react';
import { Menu, AlertCircle, X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { ThemeToggle } from '../common/ThemeToggle';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { motion, AnimatePresence } from 'framer-motion';
interface ChatAreaProps {
  onOpenSidebar: () => void;
}
export function ChatArea({ onOpenSidebar }: ChatAreaProps) {
  const { conversations, activeConversationId, globalError, clearGlobalError } =
  useChatStore();
  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );
  return (
    <div className="flex-1 flex flex-col h-screen bg-white dark:bg-gray-950 relative">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            
            <Menu size={20} />
          </button>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-md">
            {activeConversation?.title || 'New Conversation'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Global Error Banner */}
      <AnimatePresence>
        {globalError &&
        <motion.div
          initial={{
            opacity: 0,
            y: -20
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          exit={{
            opacity: 0,
            y: -20
          }}
          className="absolute top-14 left-0 right-0 z-20 p-3 bg-red-500 text-white flex items-center justify-between shadow-md">
          
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={16} />
              {globalError}
            </div>
            <button
            onClick={clearGlobalError}
            className="p-1 hover:bg-red-600 rounded-md transition-colors">
            
              <X size={16} />
            </button>
          </motion.div>
        }
      </AnimatePresence>

      {/* Main Chat Content */}
      <MessageList />

      {/* Input Area */}
      <ChatInput />
    </div>);

}