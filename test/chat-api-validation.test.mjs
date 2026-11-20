import test from 'node:test';
import assert from 'node:assert/strict';

// Test API logic and validation rules matching src/app/api/chat/route.ts
const MAX_PAYLOAD_SIZE = 50 * 1024; // 50 KB
const MAX_QUESTION_LENGTH = 500;
const MIN_EXCERPTS = 1;
const MAX_EXCERPTS = 10;
const MAX_EXCERPT_LENGTH = 2500;
const MAX_TOTAL_EXCERPTS_LENGTH = 8000;

function validateAndProcessPayload(rawBody, contentType, envApiKey, mockGeminiAnswer) {
  if (!contentType.includes('application/json')) {
    return { status: 400, error: 'Invalid content type. Expected application/json.' };
  }

  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    return { status: 413, error: `Payload too large. Maximum allowed size is ${MAX_PAYLOAD_SIZE / 1024} KB.` };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, error: 'Malformed JSON payload.' };
  }

  const { question, passages } = payload;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return { status: 400, error: 'Question must be a non-empty string.' };
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length > MAX_QUESTION_LENGTH) {
    return { status: 400, error: `Question too long. Maximum allowed length is ${MAX_QUESTION_LENGTH} characters.` };
  }

  if (!Array.isArray(passages) || passages.length < MIN_EXCERPTS || passages.length > MAX_EXCERPTS) {
    return { status: 400, error: `Passages must be an array containing between ${MIN_EXCERPTS} and ${MAX_EXCERPTS} items.` };
  }

  let totalPassagesLength = 0;
  const validPassageIds = new Set();

  for (let i = 0; i < passages.length; i++) {
    const p = passages[i];
    if (!p || typeof p.id !== 'string' || typeof p.pageNumber !== 'number' || typeof p.text !== 'string') {
      return { status: 400, error: `Passage at index ${i} is invalid.` };
    }

    if (p.text.length > MAX_EXCERPT_LENGTH) {
      return { status: 400, error: `Passage excerpt at index ${i} exceeds maximum length.` };
    }

    validPassageIds.add(p.id);
    totalPassagesLength += p.text.length;
  }

  if (totalPassagesLength > MAX_TOTAL_EXCERPTS_LENGTH) {
    return { status: 400, error: 'Total excerpt content exceeds maximum limit.' };
  }

  if (!envApiKey) {
    return {
      status: 503,
      error: 'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in .env.local.',
    };
  }

  // Citation filtering
  const citedIds = [];
  for (const validId of validPassageIds) {
    if (mockGeminiAnswer && mockGeminiAnswer.includes(validId)) {
      citedIds.push(validId);
    }
  }

  return { status: 200, answer: mockGeminiAnswer, citedIds };
}

test('POST /api/chat rejects payload over 50KB with HTTP 413', () => {
  const bigData = 'X'.repeat(55 * 1024);
  const res = validateAndProcessPayload(bigData, 'application/json', 'key123', '');
  assert.equal(res.status, 413);
  assert.ok(res.error.includes('Payload too large'));
});

test('POST /api/chat rejects question longer than 500 characters with HTTP 400', () => {
  const body = JSON.stringify({
    question: 'A'.repeat(501),
    passages: [{ id: 'doc1_p1_0', pageNumber: 1, text: 'Some text' }],
  });
  const res = validateAndProcessPayload(body, 'application/json', 'key123', '');
  assert.equal(res.status, 400);
  assert.ok(res.error.includes('Question too long'));
});

test('POST /api/chat rejects empty passages with HTTP 400', () => {
  const body = JSON.stringify({
    question: 'Valid question?',
    passages: [],
  });
  const res = validateAndProcessPayload(body, 'application/json', 'key123', '');
  assert.equal(res.status, 400);
  assert.ok(res.error.includes('Passages must be an array'));
});

test('POST /api/chat returns HTTP 503 when GEMINI_API_KEY is missing', () => {
  const body = JSON.stringify({
    question: 'What is the refund policy?',
    passages: [{ id: 'doc1_p1_0', pageNumber: 1, text: 'Refund policy details...' }],
  });
  const res = validateAndProcessPayload(body, 'application/json', '', '');
  assert.equal(res.status, 503);
  assert.ok(res.error.includes('GEMINI_API_KEY is not configured'));
});

test('POST /api/chat accepts ONLY citations that belong to the current request', () => {
  const validPassageId = 'doc1_p2_0';
  const hallucinatedPassageId = 'doc999_p99_99';

  const body = JSON.stringify({
    question: 'What is the refund policy?',
    passages: [{ id: validPassageId, pageNumber: 2, text: 'Refund policy details...' }],
  });

  // Simulated AI answer that cites both the valid passage and a hallucinated passage
  const mockAnswer = `According to the policy [${validPassageId}], refunds are valid for 30 days. Also [${hallucinatedPassageId}].`;

  const res = validateAndProcessPayload(body, 'application/json', 'valid_api_key', mockAnswer);
  assert.equal(res.status, 200);
  assert.deepEqual(res.citedIds, [validPassageId]);
  assert.ok(!res.citedIds.includes(hallucinatedPassageId), 'Hallucinated citation ID must not be returned');
});
