'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DocumentList } from '@/components/DocumentList';
import { ChatArea } from '@/components/ChatArea';
import { CitationModal } from '@/components/CitationModal';
import {
  getAllDocuments,
  saveDocument,
  updateDocumentStatus,
  savePassages,
  getPassagesByDocId,
  deleteDocument as deleteDocFromDB,
  clearAllData,
} from '@/lib/db';
import { extractTextFromPDF, chunkPageIntoPassages } from '@/lib/pdf';
import { workerClient } from '@/lib/worker-client';
import { rankAndSelectPassages } from '@/lib/vector-search';
import type {
  DocumentMeta,
  ChatMessage,
  Passage,
  PassageExcerpt,
  WorkerModelProgress,
  WorkerIndexingProgress,
  ChatResponsePayload,
} from '@/types';

export default function Home() {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, ChatMessage[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [modelProgress, setModelProgress] = useState<WorkerModelProgress | null>(null);
  const [indexingProgress, setIndexingProgress] = useState<
    (WorkerIndexingProgress & { docId?: string }) | null
  >(null);

  // Citation modal state
  const [activeExcerpt, setActiveExcerpt] = useState<PassageExcerpt | null>(null);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState<boolean>(false);

  // Mobile sidebar drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // 1. Initial load from IndexedDB on page mount
  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !selectedDocId) {
        // Automatically select the first ready document
        const firstReady = docs.find((d) => d.status === 'ready');
        if (firstReady) {
          setSelectedDocId(firstReady.id);
        }
      }
    } catch (err) {
      console.error('Failed to load documents from IndexedDB:', err);
    }
  }, [selectedDocId]);

  useEffect(() => {
    refreshDocuments();

    // Initialize worker client and subscribe to progress
    const unsubModel = workerClient.onModelProgress((progress) => {
      setModelProgress(progress);
      if (progress.status === 'ready') {
        // Clear download banner shortly after ready
        setTimeout(() => setModelProgress(null), 3000);
      }
    });

    const unsubIndexing = workerClient.onIndexingProgress((progress) => {
      setIndexingProgress(progress);
    });

    return () => {
      unsubModel();
      unsubIndexing();
    };
  }, [refreshDocuments]);

  // 2. Import one or more PDFs locally
  const handleUploadPDFs = async (files: FileList) => {
    setIsProcessingUpload(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newDocMeta: DocumentMeta = {
        id: docId,
        filename: file.name,
        fileSize: file.size,
        totalPages: 0,
        passageCount: 0,
        status: 'indexing',
        createdAt: Date.now(),
      };

      // Save initial metadata immediately to IndexedDB
      await saveDocument(newDocMeta);
      await refreshDocuments();
      setSelectedDocId(docId);

      try {
        // Step A: Extract text page by page with PDF.js (Local, strictly in browser)
        const extraction = await extractTextFromPDF(file);

        if (!extraction.hasText) {
          // Document has no extractable text (likely scanned)
          await updateDocumentStatus(
            docId,
            'no-text',
            'This PDF has no extractable text. It may be scanned and needs OCR.'
          );
          await refreshDocuments();
          continue;
        }

        // Step B: Split text into overlapping passages
        const rawPassages: Omit<Passage, 'embedding'>[] = [];
        for (const page of extraction.pages) {
          const chunks = chunkPageIntoPassages(
            docId,
            file.name,
            page.pageNumber,
            page.text,
            450, // target chunk size
            100  // overlap
          );
          rawPassages.push(...chunks);
        }

        if (rawPassages.length === 0) {
          await updateDocumentStatus(
            docId,
            'no-text',
            'No usable text passages could be generated from this document.'
          );
          await refreshDocuments();
          continue;
        }

        // Step C: Vectorize passages locally using Transformers.js in Web Worker
        const embeddingResults = await workerClient.embedPassages(
          docId,
          rawPassages.map((p) => ({ id: p.id, text: p.text }))
        );

        // Map embeddings back to full passages
        const resultMap = new Map(embeddingResults.map((r) => [r.id, r.embedding]));
        const fullPassages: Passage[] = rawPassages.map((p) => ({
          ...p,
          embedding: resultMap.get(p.id) || [],
        }));

        // Step D: Save passages and embeddings in IndexedDB
        await savePassages(fullPassages);

        // Update document status to ready
        await updateDocumentStatus(
          docId,
          'ready',
          undefined,
          fullPassages.length,
          Date.now()
        );

        await refreshDocuments();
      } catch (err: any) {
        console.error(`Error indexing document ${file.name}:`, err);
        await updateDocumentStatus(
          docId,
          'error',
          err?.message || 'Failed to extract or embed document text.'
        );
        await refreshDocuments();
      }
    }

    setIndexingProgress(null);
    setIsProcessingUpload(false);
  };

  // 3. Delete a document and its saved passages/embeddings from IndexedDB
  const handleDeleteDoc = async (id: string) => {
    if (confirm('Delete this document and its local embeddings from your browser?')) {
      await deleteDocFromDB(id);
      if (selectedDocId === id) {
        setSelectedDocId(null);
      }
      setConversations((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refreshDocuments();
    }
  };

  // 4. Clear all stored data
  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all stored documents and embeddings?')) {
      await clearAllData();
      setSelectedDocId(null);
      setConversations({});
      await refreshDocuments();
    }
  };

  // 5. Ask a question about the selected document
  const handleSendMessage = async (question: string) => {
    if (!selectedDocId) return;

    const currentDoc = documents.find((d) => d.id === selectedDocId);
    if (!currentDoc || currentDoc.status !== 'ready') return;

    // Create user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: Date.now(),
    };

    setConversations((prev) => ({
      ...prev,
      [selectedDocId]: [...(prev[selectedDocId] || []), userMsg],
    }));

    setIsLoading(true);

    try {
      // Step A: Vectorize question locally in Web Worker
      const queryEmbedding = await workerClient.embedQuery(question);

      // Step B: Retrieve all passages for this document from IndexedDB
      const allDocPassages = await getPassagesByDocId(selectedDocId);

      // Step C: Rank passages locally by cosine similarity and enforce total text-size limit
      const topPassages = rankAndSelectPassages(queryEmbedding, allDocPassages, 4, 3000);

      if (topPassages.length === 0) {
        const botMsg: ChatMessage = {
          id: `msg_bot_${Date.now()}`,
          sender: 'assistant',
          text: 'I couldn’t find that in this document.',
          timestamp: Date.now(),
        };
        setConversations((prev) => ({
          ...prev,
          [selectedDocId]: [...(prev[selectedDocId] || []), botMsg],
        }));
        setIsLoading(false);
        return;
      }

      // Step D: Send ONLY question and selected passages to POST /api/chat
      // Notice: PDF file, embeddings, and full document index are NEVER sent
      const payloadExcerpts = topPassages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        text: p.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          passages: payloadExcerpts,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server returned error (${res.status})`);
      }

      const { answer, citedIds } = data as ChatResponsePayload;

      // Map verified citation IDs to page numbers
      const excerptMap = new Map(payloadExcerpts.map((p) => [p.id, p]));
      const citations = (citedIds || [])
        .map((id) => {
          const matched = excerptMap.get(id);
          return matched ? { id, pageNumber: matched.pageNumber } : null;
        })
        .filter(Boolean) as Array<{ id: string; pageNumber: number }>;

      const botMsg: ChatMessage = {
        id: `msg_bot_${Date.now()}`,
        sender: 'assistant',
        text: answer,
        timestamp: Date.now(),
        citations,
        excerpts: payloadExcerpts,
      };

      setConversations((prev) => ({
        ...prev,
        [selectedDocId]: [...(prev[selectedDocId] || []), botMsg],
      }));
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'assistant',
        text: `Error: ${err?.message || 'Failed to communicate with the server.'}`,
        timestamp: Date.now(),
      };
      setConversations((prev) => ({
        ...prev,
        [selectedDocId]: [...(prev[selectedDocId] || []), errorMsg],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId) || null;
  const currentMessages = selectedDocId ? conversations[selectedDocId] || [] : [];

  return (
    <main className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar: Document Management (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <DocumentList
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDoc={(id) => {
            setSelectedDocId(id);
            setIsSidebarOpen(false);
          }}
          onUploadPDFs={handleUploadPDFs}
          onDeleteDoc={handleDeleteDoc}
          onClearAll={handleClearAll}
          indexingProgress={indexingProgress}
          isProcessingUpload={isProcessingUpload}
        />
      </aside>

      {/* Backdrop for mobile drawer */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Interface */}
      <section className="flex-1 flex flex-col h-full min-w-0">
        <ChatArea
          selectedDoc={selectedDoc}
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          modelProgress={modelProgress}
          onOpenCitation={(excerpt, docName) => {
            setActiveExcerpt(excerpt);
            setIsCitationModalOpen(true);
          }}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
      </section>

      {/* Clickable Citation Preview Modal */}
      <CitationModal
        isOpen={isCitationModalOpen}
        onClose={() => setIsCitationModalOpen(false)}
        excerpt={activeExcerpt}
        documentName={selectedDoc?.filename}
      />
    </main>
  );
}
