import type { Passage, ScoredPassage } from '@/types';

/**
 * Compute cosine similarity between two float vectors.
 * Because vectors produced with normalize: true have unit norm (||v|| = 1),
 * cosine similarity is equal to their dot product:
 * similarity = sum(a[i] * b[i])
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Rank passages belonging to the selected document by cosine similarity against the query embedding.
 * Starts with the best passages (up to topK = 4) and enforces a total text-size limit.
 */
export function rankAndSelectPassages(
  queryEmbedding: number[],
  passages: Passage[],
  topK: number = 4,
  maxTotalChars: number = 3000
): ScoredPassage[] {
  if (passages.length === 0 || queryEmbedding.length === 0) {
    return [];
  }

  // Calculate similarity score for each passage
  const scored: ScoredPassage[] = passages.map((p) => ({
    id: p.id,
    pageNumber: p.pageNumber,
    text: p.text,
    filename: p.filename,
    score: cosineSimilarity(queryEmbedding, p.embedding),
  }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Take top candidates and enforce total character limit
  const selected: ScoredPassage[] = [];
  let currentTotalChars = 0;

  for (let i = 0; i < Math.min(topK, scored.length); i++) {
    const candidate = scored[i];
    if (currentTotalChars + candidate.text.length <= maxTotalChars) {
      selected.push(candidate);
      currentTotalChars += candidate.text.length;
    } else {
      // If adding the whole candidate exceeds the budget, truncate it to fit the remaining budget
      const remainingBudget = maxTotalChars - currentTotalChars;
      if (remainingBudget >= 150) {
        selected.push({
          ...candidate,
          text: candidate.text.slice(0, remainingBudget) + '...',
        });
      }
      break;
    }
  }

  return selected;
}
