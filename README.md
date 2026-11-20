# Browser-Based Local RAG with Next.js & Gemini API

A privacy-first web application that allows users to chat with their own PDF documents locally in the browser. 

Documents are extracted and vectorized entirely client-side on the user's device. The PDF file, embeddings, and full document index are **never** transmitted to any server or AI provider. Gemini is contacted only at query time via a stateless server route with the user's question and the top-matching local excerpts.

---

## Architecture Overview

```
                      +-------------------------------------------------------+
                      |                    CLIENT BROWSER                     |
                      |                                                       |
                      |  1. Upload PDF  ----->  PDF.js (Extract text pages)   |
                      |                                |                      |
                      |                                v                      |
                      |                         Chunk passages                |
                      |                                |                      |
                      |                                v                      |
                      |   Web Worker   <----->  Transformers.js               |
                      |                         (all-MiniLM-L6-v2)            |
                      |                                |                      |
                      |                                v                      |
                      |                           IndexedDB                   |
                      |                    (docs, passages, vectors)          |
                      |                                |                      |
                      |   Question  --------->  Local Vector Search           |
                      |                         (Cosine Similarity Ranking)   |
                      |                                |                      |
                      +--------------------------------|----------------------+
                                                       |
                                      Question + Top 4 Excerpts ONLY
                                      (NO PDF, NO vectors, NO full index)
                                                       |
                                                       v
                      +-------------------------------------------------------+
                      |                 NEXT.JS SERVER ROUTE                  |
                      |                    (POST /api/chat)                   |
                      |                                                       |
                      |  - Validates payload (<50KB, <=500 char question)     |
                      |  - Stateless: Zero logging, zero caching, no doc DB   |
                      |  - Strictly cites source IDs & verifies citations     |
                      |                                |                      |
                      +--------------------------------|----------------------+
                                                       |
                                                       v
                                            Google Gemini API
```

### Key Highlights
1. **Local Text Extraction**: Uses `pdfjs-dist` directly in the browser to extract text page by page.
2. **Local Vectorization**: Uses `Transformers.js` (`@xenova/transformers`) with `Xenova/all-MiniLM-L6-v2` running in a dedicated **Web Worker**, keeping the main UI thread 100% fluid.
3. **Local Persistence**: Stores document metadata, extracted passages, and 384-dimensional embeddings in **IndexedDB**. Reopening or refreshing the page retains indexed documents without re-indexing.
4. **Stateless Backend**: The Next.js App Router API route (`/api/chat`) receives only the question and up to 4 top-ranked excerpts. `GEMINI_API_KEY` is kept safe on the server.
5. **Strict Grounding & Verified Citations**: If information is absent, Gemini replies *"I couldn’t find that in this document."* Citations are verified server-side and rendered in the browser as clickable badges that display the exact excerpt and page number.
6. **Multi-User Isolation**: No database or shared cloud storage. Each user's documents are isolated in their own browser profile.

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v26)
- npm or pnpm

### 1. Installation
Clone or navigate to the repository and install dependencies:
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` to provide your Gemini API key:
```env
# Google AI Studio API Key (https://aistudio.google.com/)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Optional: Gemini model override (defaults to gemini-2.5-flash)
GEMINI_MODEL=gemini-2.5-flash
```

### 3. Running Development Server
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running the Production Build
To create an optimized production build and start it:
```bash
npm run build
npm run start
```

### 5. Running Automated Tests
Run the test suite verifying vector search cosine similarity, passage chunking, and API route validation:
```bash
npm test
```

---

## How It Works in Practice

1. **Importing PDFs**:
   - Click **Import Local PDF(s)**. You can select one or multiple PDFs.
   - On first run, the browser downloads the quantized `all-MiniLM-L6-v2` embedding model (~23MB) and caches it locally in browser CacheStorage.
   - If a PDF is scanned or image-based with no selectable text, the app alerts the user: *"No extractable text detected. This PDF appears to be scanned or image-based and requires OCR (OCR is outside version 1)."*

2. **Asking Questions & Citations**:
   - Select a document from the left sidebar.
   - Type your question in the input box and press Enter.
   - The query is embedded locally in the Web Worker, and the highest-scoring passages are ranked using cosine similarity.
   - Only the question and the top excerpts are sent to `/api/chat`.
   - The assistant answers and cites exact source IDs. Clicking a **Page X** citation opens a modal showing the exact passage text stored in IndexedDB.

3. **Deleting Documents**:
   - Click the trash icon next to any document to delete it and all its associated passages and embeddings from IndexedDB.
   - Clearing browser site data will also purge all local storage.
