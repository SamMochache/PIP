import React from 'react';
import { Plus, MessageSquare, LogOut, X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { groupConversationsByDate } from '../../utils/formatTime';
import { ConversationItem } from './ConversationItem';
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    conversations,
    activeConversationId,
    createConversation,
    switchConversation
  } = useChatStore();
  const { user, logout } = useAuthStore();
  const groupedConversations = groupConversationsByDate(conversations);
  const handleNewChat = () => {
    createConversation();
    if (window.innerWidth < 768) {
      onClose();
    }
  };
  const handleSwitchChat = (id: string) => {
    // switchConversation is async but we don't need to await it here;
    // the store updates optimistically and fetches messages in the background.
    switchConversation(id);
    if (window.innerWidth < 768) {
      onClose();
    }
  };
  return (
    <>
      {/* Mobile overlay */}
      {isOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose} />

      }

      <div
        className={`
        fixed md:static inset-y-0 left-0 z-50
        w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-lg">
            <MessageSquare size={24} />
            <span>Support AI</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg">
            
            <X size={20} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors shadow-sm">
            
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-4">
          {Object.entries(groupedConversations).map(([group, convs]) => {
            if (convs.length === 0) return null;
            return (
              <div key={group}>
                <h3 className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  {group}
                </h3>
                <div className="space-y-1">
                  {convs.map((conv) =>
                  <ConversationItem
                    key={conv.id}
                    id={conv.id}
                    title={conv.title}
                    isActive={activeConversationId === conv.id}
                    onClick={() => handleSwitchChat(conv.id)} />

                  )}
                </div>
              </div>);

          })}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <img
              src={user?.avatar}
              alt={user?.name}
              className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-700" />
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title="Log out">
              
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </>);

}