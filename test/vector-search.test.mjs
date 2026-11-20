import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of cosine similarity (matches src/lib/vector-search.ts)
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function rankAndSelectPassages(queryEmbedding, passages, topK = 4, maxTotalChars = 3000) {
  if (passages.length === 0 || queryEmbedding.length === 0) {
    return [];
  }

  const scored = passages.map((p) => ({
    id: p.id,
    pageNumber: p.pageNumber,
    text: p.text,
    filename: p.filename,
    score: cosineSimilarity(queryEmbedding, p.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let currentTotalChars = 0;

  for (let i = 0; i < Math.min(topK, scored.length); i++) {
    const candidate = scored[i];
    if (currentTotalChars + candidate.text.length <= maxTotalChars) {
      selected.push(candidate);
      currentTotalChars += candidate.text.length;
    } else {
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

test('cosineSimilarity computes normalized dot products correctly', () => {
  // Identical unit vectors
  const v1 = [1, 0, 0];
  const v2 = [1, 0, 0];
  assert.equal(cosineSimilarity(v1, v2), 1.0);

  // Orthogonal vectors
  const v3 = [0, 1, 0];
  assert.equal(cosineSimilarity(v1, v3), 0.0);

  // Opposing vectors
  const v4 = [-1, 0, 0];
  assert.equal(cosineSimilarity(v1, v4), -1.0);
});

test('rankAndSelectPassages orders passages by similarity and caps at top 4', () => {
  const query = [1, 0, 0];
  const passages = [
    { id: 'p1', pageNumber: 1, text: 'Low match text', filename: 'doc.pdf', embedding: [0.1, 0.9, 0] },
    { id: 'p2', pageNumber: 2, text: 'Best match text', filename: 'doc.pdf', embedding: [0.99, 0.1, 0] },
    { id: 'p3', pageNumber: 2, text: 'Medium match text', filename: 'doc.pdf', embedding: [0.6, 0.4, 0] },
    { id: 'p4', pageNumber: 3, text: 'Good match text', filename: 'doc.pdf', embedding: [0.8, 0.2, 0] },
    { id: 'p5', pageNumber: 4, text: 'Fifth match text', filename: 'doc.pdf', embedding: [0.5, 0.5, 0] },
  ];

  const results = rankAndSelectPassages(query, passages, 4, 10000);
  assert.equal(results.length, 4);
  assert.equal(results[0].id, 'p2'); // Highest similarity (~0.99)
  assert.equal(results[1].id, 'p4'); // Second highest (~0.8)
  assert.equal(results[2].id, 'p3'); // Third (~0.6)
  assert.equal(results[3].id, 'p5'); // Fourth (~0.5)
});

test('rankAndSelectPassages enforces max total character budget', () => {
  const query = [1, 0];
  const longPassages = [
    { id: 'p1', pageNumber: 1, text: 'A'.repeat(500), filename: 'doc.pdf', embedding: [0.9, 0] },
    { id: 'p2', pageNumber: 2, text: 'B'.repeat(500), filename: 'doc.pdf', embedding: [0.8, 0] },
    { id: 'p3', pageNumber: 3, text: 'C'.repeat(500), filename: 'doc.pdf', embedding: [0.7, 0] },
  ];

  // Limit budget to 800 characters
  const results = rankAndSelectPassages(query, longPassages, 4, 800);
  assert.equal(results.length, 2);
  assert.equal(results[0].text.length, 500); // First fits entirely (500)
  assert.ok(results[1].text.length <= 303);   // Second truncated with ellipsis to fit remaining 300
});
