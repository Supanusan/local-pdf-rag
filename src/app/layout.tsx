import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Local Browser RAG | Private PDF Chat with Gemini',
  description:
    'Chat privately with your PDFs. All text extraction and embeddings run locally in your browser with PDF.js and Transformers.js.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
