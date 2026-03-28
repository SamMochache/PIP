import React from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
interface ConversationItemProps {
  id: string;
  title: string;
  isActive: boolean;
  onClick: () => void;
}
export function ConversationItem({
  id,
  title,
  isActive,
  onClick
}: ConversationItemProps) {
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>
      
      <MessageSquare
        size={16}
        className={
        isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
        } />
      
      <span className="flex-1 truncate text-sm font-medium">{title}</span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteConversation(id);
        }}
        className={`p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all ${isActive ? 'opacity-100' : ''}`}
        aria-label="Delete conversation">
        
        <Trash2 size={14} />
      </button>
    </div>);

}