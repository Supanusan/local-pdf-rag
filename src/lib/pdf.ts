import type { Passage } from '@/types';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface PDFExtractionResult {
  totalPages: number;
  hasText: boolean;
  pages: ExtractedPage[];
  totalChars: number;
}

/**
 * Configure PDF.js worker in the browser and extract text page by page.
 * Strictly executes on the client device - PDF bytes are NEVER sent to any server.
 */
export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  const pdfjsLib = await import('pdfjs-dist');
  
  // Point to local worker copied to /public to avoid remote network dependency
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pages: ExtractedPage[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Combine text items into a coherent string
    const strings = textContent.items
      .map((item) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .filter(Boolean);

    const pageText = strings.join(' ').replace(/\s+/g, ' ').trim();
    totalChars += pageText.length;

    pages.push({
      pageNumber: pageNum,
      text: pageText,
    });
  }

  return {
    totalPages,
    hasText: totalChars > 20, // If less than 20 characters across entire doc, treat as no text
    pages,
    totalChars,
  };
}

/**
 * Split page text into overlapping passages.
 * Each passage retains document ID, filename, page number, passage text, and a unique passage ID.
 */
export function chunkPageIntoPassages(
  docId: string,
  filename: string,
  pageNumber: number,
  pageText: string,
  chunkSize: number = 500, // Character target size
  overlap: number = 100    // Character overlap
): Omit<Passage, 'embedding'>[] {
  if (!pageText || pageText.trim().length === 0) {
    return [];
  }

  const passages: Omit<Passage, 'embedding'>[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < pageText.length) {
    let endIndex = startIndex + chunkSize;

    // Avoid cutting words right in the middle if possible
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

    // Move forward by chunk size minus overlap
    startIndex = Math.max(startIndex + 1, endIndex - overlap);
  }

  return passages;
}
