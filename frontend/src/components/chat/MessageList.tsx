import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { useChatStore } from '../../store/chatStore';
export function MessageList() {
  const { messages, activeConversationId, retryMessage } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeMessages = activeConversationId ?
  messages[activeConversationId] || [] :
  [];
  useEffect(() => {
    // Smooth scroll to bottom when messages change
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [activeMessages]);
  if (activeMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-3xl">👋</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          How can I help you today?
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-md">
          Ask me anything about our products, policies, or technical
          documentation. I'm here to assist you.
        </p>
      </div>);

  }
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
      {activeMessages.map((message) =>
      <MessageBubble
        key={message.id}
        message={message}
        onRetry={() => retryMessage(message.id)} />

      )}
      <div ref={bottomRef} className="h-px" />
    </div>);

}