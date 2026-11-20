import { pipeline, env } from '@xenova/transformers';

// Configure Transformers.js for browser client-side execution
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

let extractorInstance: any = null;
let isInitializing = false;
const initWaiters: Array<(instance: any) => void> = [];

async function getExtractor(): Promise<any> {
  if (extractorInstance) {
    return extractorInstance;
  }

  if (isInitializing) {
    return new Promise((resolve) => {
      initWaiters.push(resolve);
    });
  }

  isInitializing = true;
  self.postMessage({
    type: 'model-progress',
    data: { status: 'initiate', modelName: MODEL_NAME },
  });

  try {
    extractorInstance = await pipeline('feature-extraction', MODEL_NAME, {
      progress_callback: (data: any) => {
        self.postMessage({
          type: 'model-progress',
          data: {
            ...data,
            modelName: MODEL_NAME,
          },
        });
      },
    });

    self.postMessage({
      type: 'model-progress',
      data: { status: 'ready', modelName: MODEL_NAME },
    });

    for (const waiter of initWaiters) {
      waiter(extractorInstance);
    }
    initWaiters.length = 0;

    return extractorInstance;
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      error: `Failed to load embedding model: ${err?.message || err}`,
    });
    throw err;
  } finally {
    isInitializing = false;
  }
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    if (type === 'init-model') {
      await getExtractor();
      return;
    }

    if (type === 'embed-passages') {
      const { docId, passages } = payload as {
        docId: string;
        passages: Array<{ id: string; text: string }>;
      };

      const pipe = await getExtractor();
      const results: Array<{ id: string; embedding: number[] }> = [];

      for (let i = 0; i < passages.length; i++) {
        const item = passages[i];
        const output = await pipe(item.text, {
          pooling: 'mean',
          normalize: true,
        });

        results.push({
          id: item.id,
          embedding: Array.from(output.data),
        });

        // Report indexing progress every passage
        self.postMessage({
          type: 'indexing-progress',
          docId,
          current: i + 1,
          total: passages.length,
        });
      }

      self.postMessage({
        type: 'embed-passages-result',
        docId,
        results,
      });
    } else if (type === 'embed-query') {
      const { queryId, text } = payload as { queryId: string; text: string };
      const pipe = await getExtractor();

      const output = await pipe(text, {
        pooling: 'mean',
        normalize: true,
      });

      self.postMessage({
        type: 'embed-query-result',
        queryId,
        embedding: Array.from(output.data),
      });
    }
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      error: err?.message || String(err),
    });
  }
});
