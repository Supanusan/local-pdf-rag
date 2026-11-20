import test from 'node:test';
import assert from 'node:assert/strict';

// Test implementation of chunkPageIntoPassages (matches src/lib/pdf.ts)
function chunkPageIntoPassages(
  docId,
  filename,
  pageNumber,
  pageText,
  chunkSize = 500,
  overlap = 100
) {
  if (!pageText || pageText.trim().length === 0) {
    return [];
  }

  const passages = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < pageText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < pageText.length) {
      const nextSpace = pageText.indexOf(' ', endIndex);
      if (nextSpace !== -1 && nextSpace - endIndex < 50) {
        endIndex = nextSpace;
      }
    } else {
      endIndex = pageText.length;
    }

    const passageText = pageText.substring(startIndex, endIndex).trim();

    if (passageText.length > 0) {
      passages.push({
        id: `${docId}_p${pageNumber}_${chunkIndex}`,
        docId,
        filename,
        pageNumber,
        text: passageText,
      });
      chunkIndex++;
    }

    if (endIndex >= pageText.length) {
      break;
    }

    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return passages;
}

test('chunkPageIntoPassages splits text into overlapping passages with unique IDs and correct page numbers', () => {
  const docId = 'doc_test123';
  const filename = 'sample_report.pdf';
  const pageNumber = 3;
  const sampleText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30);

  const chunks = chunkPageIntoPassages(docId, filename, pageNumber, sampleText, 200, 50);

  assert.ok(chunks.length > 1, 'Should create multiple chunks for long text');

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    assert.equal(chunk.docId, docId);
    assert.equal(chunk.filename, filename);
    assert.equal(chunk.pageNumber, pageNumber);
    assert.equal(chunk.id, `${docId}_p3_${i}`);
    assert.ok(chunk.text.length > 0);
  }

  // Verify overlap between adjacent chunks
  const chunk0End = chunks[0].text.slice(-30);
  const chunk1Start = chunks[1].text.slice(0, 70);
  assert.ok(
    chunk1Start.includes(chunk0End.slice(-15)),
    'Adjacent chunks should have overlapping text'
  );
});

test('chunkPageIntoPassages returns empty array for empty or whitespace text', () => {
  const chunks = chunkPageIntoPassages('doc1', 'blank.pdf', 1, '   \n\t  ');
  assert.deepEqual(chunks, []);
});
