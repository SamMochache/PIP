import React from 'react';
import { File, X, Loader2 } from 'lucide-react';
export interface Attachment {
  id: string;
  file: File;
  progress: number;
  url?: string;
}
interface FileUploadPreviewProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
}
export function FileUploadPreview({
  attachment,
  onRemove
}: FileUploadPreviewProps) {
  const isUploading = attachment.progress < 100;
  return (
    <div className="relative flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 pr-8 shadow-sm max-w-[200px]">
      <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-md text-indigo-600 dark:text-indigo-400 flex-shrink-0">
        {isUploading ?
        <Loader2 size={16} className="animate-spin" /> :

        <File size={16} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
          {attachment.file.name}
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1 overflow-hidden">
          <div
            className="bg-indigo-600 h-1 rounded-full transition-all duration-300"
            style={{
              width: `${attachment.progress}%`
            }} />
          
        </div>
      </div>

      <button
        onClick={() => onRemove(attachment.id)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        
        <X size={14} />
      </button>
    </div>);

}