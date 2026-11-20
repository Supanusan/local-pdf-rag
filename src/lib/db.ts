import { openDB, type IDBPDatabase } from 'idb';
import type { DocumentMeta, Passage } from '@/types';

const DB_NAME = 'browser_rag_db';
const DB_VERSION = 1;

interface BrowserRAGSchema {
  documents: {
    key: string;
    value: DocumentMeta;
  };
  passages: {
    key: string;
    value: Passage;
    indexes: { 'by-doc': string };
  };
}

let dbPromise: Promise<IDBPDatabase<BrowserRAGSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<BrowserRAGSchema>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only accessible in browser environments');
  }

  if (!dbPromise) {
    dbPromise = openDB<BrowserRAGSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('passages')) {
          const passageStore = db.createObjectStore('passages', { keyPath: 'id' });
          passageStore.createIndex('by-doc', 'docId');
        }
      },
    });
  }

  return dbPromise;
}

export async function saveDocument(doc: DocumentMeta): Promise<void> {
  const db = await getDB();
  await db.put('documents', doc);
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentMeta['status'],
  errorMessage?: string,
  passageCount?: number,
  indexedAt?: number
): Promise<void> {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (doc) {
    doc.status = status;
    if (errorMessage !== undefined) doc.errorMessage = errorMessage;
    if (passageCount !== undefined) doc.passageCount = passageCount;
    if (indexedAt !== undefined) doc.indexedAt = indexedAt;
    await db.put('documents', doc);
  }
}

export async function getDocument(id: string): Promise<DocumentMeta | undefined> {
  const db = await getDB();
  return db.get('documents', id);
}

export async function getAllDocuments(): Promise<DocumentMeta[]> {
  const db = await getDB();
  const docs = await db.getAll('documents');
  // Sort descending by creation date
  return docs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'passages'], 'readwrite');
  
  // Delete document entry
  await tx.objectStore('documents').delete(id);

  // Delete all passages belonging to this document
  const passageStore = tx.objectStore('passages');
  const index = passageStore.index('by-doc');
  let cursor = await index.openKeyCursor(IDBKeyRange.only(id));

  while (cursor) {
    await passageStore.delete(cursor.primaryKey);
    cursor = await cursor.continue();
  }

  await tx.done;
}

export async function savePassages(passages: Passage[]): Promise<void> {
  if (passages.length === 0) return;
  const db = await getDB();
  const tx = db.transaction('passages', 'readwrite');
  const store = tx.objectStore('passages');

  for (const passage of passages) {
    await store.put(passage);
  }

  await tx.done;
}

export async function getPassagesByDocId(docId: string): Promise<Passage[]> {
  const db = await getDB();
  return db.getAllFromIndex('passages', 'by-doc', docId);
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['documents', 'passages'], 'readwrite');
  await tx.objectStore('documents').clear();
  await tx.objectStore('passages').clear();
  await tx.done;
}
