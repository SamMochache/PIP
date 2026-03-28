import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Citation } from '../../services/mockApi';
import { motion, AnimatePresence } from 'framer-motion';
interface CitationCardProps {
  citation: Citation;
}
export function CitationCard({ citation }: CitationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
        
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText size={16} className="text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
            {citation.documentName}
          </span>
          {citation.pageNumber &&
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              Pg {citation.pageNumber}
            </span>
          }
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {Math.round(citation.relevanceScore * 100)}% match
          </span>
          {isExpanded ?
          <ChevronUp size={16} className="text-gray-400" /> :

          <ChevronDown size={16} className="text-gray-400" />
          }
        </div>
      </button>

      <AnimatePresence>
        {isExpanded &&
        <motion.div
          initial={{
            height: 0,
            opacity: 0
          }}
          animate={{
            height: 'auto',
            opacity: 1
          }}
          exit={{
            height: 0,
            opacity: 0
          }}
          transition={{
            duration: 0.2
          }}>
          
            <div className="p-3 pt-0 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              "{citation.snippet}"
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}