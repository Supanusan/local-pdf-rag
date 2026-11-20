'use client';

import React, { useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  HelpCircle,
  HardDrive,
  Layers,
} from 'lucide-react';
import type { DocumentMeta, WorkerIndexingProgress } from '@/types';

interface DocumentListProps {
  documents: DocumentMeta[];
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onUploadPDFs: (files: FileList) => void;
  onDeleteDoc: (id: string) => void;
  onClearAll: () => void;
  indexingProgress: (WorkerIndexingProgress & { docId?: string }) | null;
  isProcessingUpload: boolean;
}

export function DocumentList({
  documents,
  selectedDocId,
  onSelectDoc,
  onUploadPDFs,
  onDeleteDoc,
  onClearAll,
  indexingProgress,
  isProcessingUpload,
}: DocumentListProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadPDFs(e.target.files);
      // Reset input value so re-uploading the same file still triggers onChange
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Upload Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Documents ({documents.length})</span>
          </h2>
          {documents.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-red-500 hover:text-red-700 transition-colors font-medium"
              title="Delete all stored documents"
            >
              Clear All
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="pdf-upload-input"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessingUpload}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 group cursor-pointer"
        >
          {isProcessingUpload ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Extracting & Indexing...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
              <span>Import Local PDF(s)</span>
            </>
          )}
        </button>
        <p className="text-[11px] text-slate-500 mt-2 text-center">
          PDFs are processed & embedded directly in your browser.
        </p>
      </div>

      {/* Document Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">No PDFs imported</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
              Select one or more PDF files from your device to begin local chat.
            </p>
          </div>
        ) : (
          documents.map((doc) => {
            const isSelected = selectedDocId === doc.id;
            const isIndexing = doc.status === 'indexing';
            const isNoText = doc.status === 'no-text';
            const isError = doc.status === 'error';
            const isReady = doc.status === 'ready';

            const activeProgress =
              indexingProgress && indexingProgress.docId === doc.id
                ? indexingProgress
                : null;

            return (
              <div
                key={doc.id}
                onClick={() => isReady && onSelectDoc(doc.id)}
                className={`relative group rounded-xl p-3 border transition-all ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-400 shadow-sm'
                    : isReady
                    ? 'bg-white hover:bg-slate-50 border-slate-200 cursor-pointer'
                    : 'bg-slate-50 border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-start justify-between space-x-2">
                  <div className="flex items-start space-x-2.5 overflow-hidden">
                    <div
                      className={`p-2 rounded-lg mt-0.5 flex-shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : isReady
                          ? 'bg-blue-50 text-blue-600'
                          : isNoText
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h4
                        className={`text-sm font-semibold truncate ${
                          isSelected ? 'text-blue-900' : 'text-slate-800'
                        }`}
                        title={doc.filename}
                      >
                        {doc.filename}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>•</span>
                        <span>{doc.totalPages} page{doc.totalPages > 1 ? 's' : ''}</span>
                        {isReady && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-slate-600">
                              {doc.passageCount} chunks
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDoc(doc.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    title="Delete document and local embeddings"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Badges */}
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  {isReady && (
                    <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Ready to chat</span>
                    </span>
                  )}

                  {isIndexing && (
                    <div className="w-full">
                      <div className="flex items-center justify-between text-blue-700 text-[11px] mb-1">
                        <span className="inline-flex items-center space-x-1 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span>Vectorizing locally...</span>
                        </span>
                        {activeProgress && (
                          <span className="font-mono">
                            {activeProgress.current}/{activeProgress.total}
                          </span>
                        )}
                      </div>
                      {activeProgress && (
                        <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.round(
                                (activeProgress.current / activeProgress.total) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {isNoText && (
                    <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-800">
                      <div className="flex items-start space-x-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>No extractable text detected</span>
                      </div>
                      <p className="mt-1 text-amber-700 leading-tight">
                        This PDF appears to be scanned or image-based and requires OCR. (OCR is outside version 1).
                      </p>
                    </div>
                  )}

                  {isError && (
                    <div className="w-full bg-red-50 border border-red-200 rounded-lg p-2 text-[11px] text-red-800">
                      <div className="flex items-center space-x-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                        <span>Failed to index</span>
                      </div>
                      {doc.errorMessage && (
                        <p className="mt-1 text-red-700 leading-tight">
                          {doc.errorMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Local Storage & Multi-user Explanation Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1.5">
        <div className="flex items-start space-x-2 text-slate-700">
          <HardDrive className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="leading-tight">
            <strong>Local Storage (IndexedDB):</strong> Clearing site data removes saved documents. Documents do not sync across devices or browser profiles.
          </p>
        </div>
        <div className="flex items-start space-x-2 text-slate-700">
          <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="leading-tight">
            Each user’s documents remain completely private inside their own browser.
          </p>
        </div>
      </div>
    </div>
  );
}
