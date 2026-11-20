import type { WorkerModelProgress, WorkerIndexingProgress } from '@/types';

class EmbeddingWorkerClient {
  private worker: Worker | null = null;
  private modelProgressListeners: Set<(progress: WorkerModelProgress) => void> = new Set();
  private indexingProgressListeners: Set<(progress: WorkerIndexingProgress & { docId?: string }) => void> = new Set();
  private pendingQueries: Map<string, (embedding: number[]) => void> = new Map();
  private pendingPassages: Map<string, (results: Array<{ id: string; embedding: number[] }>) => void> = new Map();
  private isModelReady = false;

  private getWorker(): Worker {
    if (!this.worker && typeof window !== 'undefined') {
      this.worker = new Worker(
        new URL('../workers/embedding.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, data, docId, current, total, queryId, embedding, results, error } = event.data;

        if (type === 'model-progress') {
          if (data?.status === 'ready') {
            this.isModelReady = true;
          }
          this.modelProgressListeners.forEach((fn) => fn(data));
        } else if (type === 'indexing-progress') {
          this.indexingProgressListeners.forEach((fn) => fn({ docId, current, total }));
        } else if (type === 'embed-query-result') {
          const resolver = this.pendingQueries.get(queryId);
          if (resolver) {
            resolver(embedding);
            this.pendingQueries.delete(queryId);
          }
        } else if (type === 'embed-passages-result') {
          const resolver = this.pendingPassages.get(docId);
          if (resolver) {
            resolver(results);
            this.pendingPassages.delete(docId);
          }
        } else if (type === 'error') {
          console.error('[EmbeddingWorker Error]', error);
        }
      };
    }
    return this.worker!;
  }

  public init(): void {
    if (typeof window === 'undefined') return;
    const worker = this.getWorker();
    worker.postMessage({ type: 'init-model' });
  }

  public onModelProgress(listener: (progress: WorkerModelProgress) => void): () => void {
    this.modelProgressListeners.add(listener);
    return () => this.modelProgressListeners.delete(listener);
  }

  public onIndexingProgress(listener: (progress: WorkerIndexingProgress & { docId?: string }) => void): () => void {
    this.indexingProgressListeners.add(listener);
    return () => this.indexingProgressListeners.delete(listener);
  }

  public async embedQuery(text: string): Promise<number[]> {
    const worker = this.getWorker();
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise((resolve) => {
      this.pendingQueries.set(queryId, resolve);
      worker.postMessage({
        type: 'embed-query',
        payload: { queryId, text },
      });
    });
  }

  public async embedPassages(
    docId: string,
    passages: Array<{ id: string; text: string }>
  ): Promise<Array<{ id: string; embedding: number[] }>> {
    const worker = this.getWorker();

    return new Promise((resolve) => {
      this.pendingPassages.set(docId, resolve);
      worker.postMessage({
        type: 'embed-passages',
        payload: { docId, passages },
      });
    });
  }
}

export const workerClient = new EmbeddingWorkerClient();
