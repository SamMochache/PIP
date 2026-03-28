import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
interface CopyButtonProps {
  text: string;
  className?: string;
}
export function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
      title="Copy to clipboard">
      
      {copied ?
      <Check size={16} className="text-green-500" /> :

      <Copy size={16} />
      }
    </button>);

}