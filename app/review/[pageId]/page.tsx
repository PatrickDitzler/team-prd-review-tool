import { promises as fs } from 'fs';
import path from 'path';
import ReviewPanel from './ReviewPanel';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default async function ReviewPage({ params }: { params: Promise<{ pageId: string }> }) {
  const resolvedParams = await params;
  const { pageId } = resolvedParams;
  let markdown = '';
  let error = '';

  try {
    const filePath = path.join(process.cwd(), 'prds', `${pageId}.md`);
    markdown = await fs.readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    console.error('Failed to read PRD file', err);
    error = 'Could not find the requested PRD. Did you fetch it first?';
  }

  return (
    <div className="review-page-container">
      <header className="review-header">
        <Link href="/" className="icon-button back-link" aria-label="Go back">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="review-title">PRD Review Session</h1>
          <p className="review-subtitle">Review with your team, ask questions, and break down the work.</p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <ThemeToggle />
        </div>
      </header>

      {error ? (
        <div className="status-banner status-banner--error">
          <span className="status-banner-icon">✕</span>
          {error}
        </div>
      ) : (
        <ReviewPanel markdown={markdown} pageId={pageId} />
      )}
    </div>
  );
}
