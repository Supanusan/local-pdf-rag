'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  FileText,
  Loader2,
  ExternalLink,
  Download,
  AlertCircle,
  Menu,
} from 'lucide-react';
import type {
  ChatMessage,
  DocumentMeta,
  PassageExcerpt,
  WorkerModelProgress,
} from '@/types';

interface ChatAreaProps {
  selectedDoc: DocumentMeta | null;
  messages: ChatMessage[];
  onSendMessage: (question: string) => Promise<void>;
  isLoading: boolean;
  modelProgress: WorkerModelProgress | null;
  onOpenCitation: (excerpt: PassageExcerpt, docName?: string) => void;
  onToggleSidebar?: () => void;
}

export function ChatArea({
  selectedDoc,
  messages,
  onSendMessage,
  isLoading,
  modelProgress,
  onOpenCitation,
  onToggleSidebar,
}: ChatAreaProps) {
  const [inputQuestion, setInputQuestion] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isLoading || !selectedDoc || selectedDoc.status !== 'ready') {
      return;
    }
    const q = inputQuestion.trim();
    setInputQuestion('');
    await onSendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isModelDownloading =
    modelProgress &&
    (modelProgress.status === 'initiate' ||
      modelProgress.status === 'download' ||
      modelProgress.status === 'progress');

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              title="Toggle documents list"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-lg shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-tight">
                {selectedDoc ? selectedDoc.filename : 'Select a PDF to start chat'}
              </h1>
              <p className="text-xs text-slate-500">
                {selectedDoc ? (
                  <span>
                    {selectedDoc.totalPages} page{selectedDoc.totalPages > 1 ? 's' : ''} •{' '}
                    {selectedDoc.passageCount} local index chunks
                  </span>
                ) : (
                  'Local embedding & stateless search'
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-medium border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Local Vector Search Active</span>
        </div>
      </div>

      {/* Embedding Model Download Progress Banner */}
      {isModelDownloading && (
        <div className="bg-blue-600 text-white px-4 py-2.5 text-xs flex items-center justify-between animate-fadeIn shadow-sm">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Download className="w-4 h-4 animate-bounce flex-shrink-0" />
            <span className="font-medium truncate">
              Downloading local embedding model ({modelProgress.modelName || 'all-MiniLM-L6-v2'}) for in-browser vectorization...
            </span>
          </div>
          {typeof modelProgress.progress === 'number' && (
            <span className="font-mono bg-blue-700 px-2 py-0.5 rounded text-[11px] ml-2 flex-shrink-0">
              {Math.round(modelProgress.progress)}%
            </span>
          )}
        </div>
      )}

      {/* Main Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {!selectedDoc ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-sm">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No Document Selected</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Import a PDF from the sidebar or click an already indexed document to start asking questions.
            </p>
            <div className="mt-6 p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 text-left space-y-2 shadow-xs">
              <div className="flex items-center space-x-2 text-slate-800 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>How Privacy Works:</span>
              </div>
              <p>
                1. Your PDF is extracted & vectorized completely on your device using Web Workers and local Transformers.js.
              </p>
              <p>
                2. Only the specific passages relevant to your question are sent to Gemini to generate an answer.
              </p>
            </div>
          </div>
        ) : selectedDoc.status === 'no-text' ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Scanned Document Detected</h3>
            <p className="text-sm text-amber-800 mt-2 leading-relaxed">
              This PDF contains no extractable digital text. It is likely a scanned document or image collection requiring OCR. Optical Character Recognition (OCR) is outside this version.
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Please try importing a PDF containing selectable text.
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Ready to chat with &ldquo;{selectedDoc.filename}&rdquo;
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Ask any question about this document. The browser will embed your query, rank passages locally, and ask Gemini for an answer grounded strictly in the text.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </div>

                  {/* Assistant Citations & Excerpts */}
                  {!isUser && msg.excerpts && msg.excerpts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center space-x-1">
                        <FileText className="w-3 h-3 text-blue-600" />
                        <span>Source Citations:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.excerpts.map((excerpt) => {
                          const isCitedByGemini =
                            msg.citations?.some((c) => c.id === excerpt.id) ?? false;

                          return (
                            <button
                              key={excerpt.id}
                              onClick={() => onOpenCitation(excerpt, selectedDoc?.filename)}
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                isCitedByGemini
                                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 shadow-2xs font-semibold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                              }`}
                              title="Click to view exact saved excerpt from PDF"
                            >
                              <span>Page {excerpt.pageNumber}</span>
                              {isCitedByGemini && (
                                <span className="bg-blue-600 text-white text-[10px] px-1 py-0.2 rounded-xs ml-1">
                                  Cited
                                </span>
                              )}
                              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div
                    className={`text-[10px] mt-1.5 text-right ${
                      isUser ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Searching local passages & consulting Gemini...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Question Input Area */}
      <div className="p-4 bg-white border-t border-slate-200">
        {/* MANDATORY PRIVACY NOTICE NEAR QUESTION BOX */}
        <div className="mb-2.5 flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="leading-tight">
            Your PDFs stay in this browser. When you ask a question, your question and relevant excerpts are sent to Gemini.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedDoc || selectedDoc.status !== 'ready' || isLoading}
              placeholder={
                !selectedDoc
                  ? 'Select or import a PDF first...'
                  : selectedDoc.status === 'no-text'
                  ? 'This document has no readable text...'
                  : 'Ask a question about this document... (Enter to send, Shift+Enter for new line)'
              }
              className="w-full resize-none p-3 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={
              !inputQuestion.trim() ||
              !selectedDoc ||
              selectedDoc.status !== 'ready' ||
              isLoading
            }
            className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-xs transition-all disabled:cursor-not-allowed flex-shrink-0 group"
            title="Send question"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
