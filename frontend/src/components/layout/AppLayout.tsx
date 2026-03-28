import React, { useState } from 'react';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatArea } from '../chat/ChatArea';
export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <ChatArea onOpenSidebar={() => setIsSidebarOpen(true)} />
    </div>);

}