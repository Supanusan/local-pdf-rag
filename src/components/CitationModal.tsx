'use client';

import React, { useEffect } from 'react';
import { X, FileText, Bookmark } from 'lucide-react';
import type { PassageExcerpt } from '@/types';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  excerpt: PassageExcerpt | null;
  documentName?: string;
}

export function CitationModal({
  isOpen,
  onClose,
  excerpt,
  documentName,
}: CitationModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !excerpt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Verified Document Excerpt
              </h3>
              <p className="text-xs text-slate-500">
                {documentName || 'Local PDF Document'} • Page {excerpt.pageNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md font-mono">
            <span className="flex items-center space-x-1.5">
              <Bookmark className="w-3.5 h-3.5 text-blue-600" />
              <span>Source ID:</span>
            </span>
            <span className="text-slate-700 font-semibold">{excerpt.id}</span>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">
              Exact Saved Excerpt (From Local Index)
            </label>
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-lg text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
              "{excerpt.text}"
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Stored locally in browser IndexedDB</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
