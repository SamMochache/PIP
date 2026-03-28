import React, { useState, useEffect } from "react";
import { Sidebar } from "../sidebar/Sidebar";
import { ChatArea } from "../chat/ChatArea";
import { useChatStore } from "../../store/chatStore";

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const loadConversations = useChatStore((s) => s.loadConversations);

  // Fetch the user's conversations from the backend when the app first loads
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <ChatArea onOpenSidebar={() => setIsSidebarOpen(true)} />
    </div>
  );
}
