export interface DocumentMeta {
  id: string;
  filename: string;
  fileSize: number;
  totalPages: number;
  passageCount: number;
  status: 'indexing' | 'ready' | 'error' | 'no-text';
  errorMessage?: string;
  createdAt: number;
  indexedAt?: number;
}

export interface Passage {
  id: string; // Unique passage ID, e.g. `${docId}_p${page}_${seq}`
  docId: string;
  filename: string;
  pageNumber: number;
  text: string;
  embedding: number[]; // 384-dimensional vector from all-MiniLM-L6-v2
}

export interface Citation {
  id: string;
  pageNumber: number;
}

export interface PassageExcerpt {
  id: string;
  pageNumber: number;
  text: string;
}

export interface ScoredPassage extends PassageExcerpt {
  score: number;
  filename: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  citations?: Citation[];
  excerpts?: PassageExcerpt[]; // Sent excerpts retained client-side for viewing citations
}

export interface WorkerModelProgress {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  modelName?: string;
}

export interface WorkerIndexingProgress {
  current: number;
  total: number;
}

// Request and Response types for POST /api/chat
export interface ChatRequestPayload {
  question: string;
  passages: Array<{
    id: string;
    pageNumber: number;
    text: string;
  }>;
}

export interface ChatResponsePayload {
  answer: string;
  citedIds: string[];
}
