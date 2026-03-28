import React, { useEffect, useState, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { mockApi } from '../../services/mockApi';
import { FileUploadPreview, Attachment } from './FileUploadPreview';
export function ChatInput() {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, isStreaming } = useChatStore();
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);
  const handleSend = () => {
    if (!input.trim() && attachments.length === 0 || isStreaming) return;
    // Check if any attachments are still uploading
    if (attachments.some((a) => a.progress < 100)) return;
    const formattedAttachments = attachments.map((a) => ({
      name: a.file.name,
      url: a.url || ''
    }));
    sendMessage(input.trim(), formattedAttachments);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newAttachments = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    // Simulate upload for each file
    for (const attachment of newAttachments) {
      try {
        const url = await mockApi.uploadFile(attachment.file, (progress) => {
          setAttachments((prev) =>
          prev.map((a) =>
          a.id === attachment.id ?
          {
            ...a,
            progress
          } :
          a
          )
          );
        });
        setAttachments((prev) =>
        prev.map((a) =>
        a.id === attachment.id ?
        {
          ...a,
          url
        } :
        a
        )
        );
      } catch (error) {
        console.error('Upload failed', error);
        // Remove failed attachment
        setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };
  const isSendDisabled =
  !input.trim() && attachments.length === 0 ||
  isStreaming ||
  attachments.some((a) => a.progress < 100);
  return (
    <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-4xl mx-auto">
        {/* Attachments Preview */}
        {attachments.length > 0 &&
        <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att) =>
          <FileUploadPreview
            key={att.id}
            attachment={att}
            onRemove={removeAttachment} />

          )}
          </div>
        }

        {/* Input Area */}
        <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all shadow-sm">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0 mb-0.5"
            title="Attach file">
            
            <Paperclip size={20} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.txt" />
          

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Support AI..."
            className="flex-1 max-h-[120px] bg-transparent border-0 focus:ring-0 resize-none py-2.5 px-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-[15px] leading-relaxed"
            rows={1} />
          

          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className={`p-2 rounded-xl flex-shrink-0 mb-0.5 transition-all ${isSendDisabled ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}>
            
            <Send
              size={18}
              className={
              isSendDisabled ? '' : 'translate-x-0.5 -translate-y-0.5'
              } />
            
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            AI can make mistakes. Consider verifying important information.
          </span>
        </div>
      </div>
    </div>);

}