import React from 'react';
import { Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { formatRelativeTime } from '../../utils/formatTime';
import { CopyButton } from '../common/CopyButton';
import { CitationCard } from './CitationCard';
import { TypingIndicator } from './TypingIndicator';
import { AlertCircle, RefreshCw, Bot, File } from 'lucide-react';
import { motion } from 'framer-motion';
interface MessageBubbleProps {
  message: Message;
  onRetry?: () => void;
}
export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const user = useAuthStore((state) => state.user);
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 10
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      className={`flex gap-4 w-full group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        {isUser ?
        <img
          src={user?.avatar}
          alt={user?.name}
          className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" /> :


        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
        }
      </div>

      {/* Message Content */}
      <div
        className={`flex flex-col max-w-[80%] md:max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {isUser ? user?.name : 'Support AI'}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>

        <div
          className={`relative flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 &&
          <div className="flex flex-wrap gap-2 mb-1">
              {message.attachments.map((att, i) =>
            <div
              key={i}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm">
              
                  <File size={16} className="text-indigo-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {att.name}
                  </span>
                </div>
            )}
            </div>
          }

          {/* Bubble */}
          <div
            className={`
            px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed
            ${isUser ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-sm'}
            ${message.status === 'error' ? 'border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-100' : ''}
          `}>
            
            {message.status === 'sending' && !isUser && !message.content ?
            <TypingIndicator /> :

            <div className="whitespace-pre-wrap break-words">
                {message.content}
                {message.status === 'sending' && isUser &&
              <span className="inline-block ml-2 w-2 h-2 bg-indigo-300 rounded-full animate-pulse" />
              }
              </div>
            }
          </div>

          {/* Error State */}
          {message.status === 'error' &&
          <div className="flex items-center gap-2 text-red-500 text-xs mt-1">
              <AlertCircle size={14} />
              <span>Failed to send</span>
              {onRetry &&
            <button
              onClick={onRetry}
              className="flex items-center gap-1 hover:underline font-medium ml-1">
              
                  <RefreshCw size={12} /> Retry
                </button>
            }
            </div>
          }

          {/* Actions (Copy) */}
          {!isUser && message.content && message.status !== 'error' &&
          <div className="absolute -right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={message.content} />
            </div>
          }
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 &&
        <div className="mt-2 w-full max-w-md">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
              Sources
            </p>
            <div className="space-y-2">
              {message.citations.map((citation) =>
            <CitationCard key={citation.id} citation={citation} />
            )}
            </div>
          </div>
        }
      </div>
    </motion.div>);

}