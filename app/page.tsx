'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Settings, FileText, Upload } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface FetchResult {
  title: string;
  markdown: string;
  filePath: string;
  pageId: string;
  spaceKey: string;
  version: number;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>,
  ) {
    e.preventDefault();
    let file: File | null = null;

    if ('dataTransfer' in e) {
      setIsDragging(false);
      file = e.dataTransfer.files?.[0] || null;
    } else {
      file = e.target.files?.[0] || null;
    }

    if (!file) return;

    // Validate type roughly
    if (!file.name.match(/\.(pdf|docx|md|txt)$/i)) {
      setError('Please upload a PDF, DOCX, or Markdown file.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during upload');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleFetch(overrideInput?: string) {
    const fetchTarget = overrideInput || input;
    if (!fetchTarget.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/confluence/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: fetchTarget.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !loading) {
      handleFetch();
    }
  }

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon" aria-hidden="true">
            📋
          </div>
          <h1 className="app-title">PRD Review Tool</h1>
        </div>
        <div
          style={{ position: 'absolute', top: '48px', right: '24px', display: 'flex', gap: '8px' }}
        >
          <ThemeToggle />
          <Link
            href="/settings"
            className="icon-button"
            aria-label="Settings"
            title="Configure AI Provider"
          >
            <Settings size={20} />
          </Link>
        </div>
        <p className="app-subtitle">
          Fetch PRDs from Confluence, review with your team, break down the work.
        </p>
      </header>

      {/* ── Fetch Card ── */}
      <div className="fetch-card">
        <label htmlFor="confluence-input" className="fetch-card-label">
          Confluence Page
        </label>
        <div className="fetch-input-row">
          <input
            id="confluence-input"
            className="fetch-input"
            type="text"
            placeholder="Paste a Confluence URL or page ID…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="off"
          />
          <button
            id="fetch-button"
            className="fetch-button"
            onClick={() => handleFetch()}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Fetching…
              </>
            ) : (
              'Fetch PRD'
            )}
          </button>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            className="btn-secondary"
            style={{ margin: 0, width: 'auto', fontSize: '13px', padding: '8px 16px' }}
            onClick={async () => {
              setInput('demo');
              await handleFetch('demo');
            }}
            disabled={loading}
          >
            Try Fake Demo PRD
          </button>
        </div>
      </div>

      <div className="divider">
        <span className="divider-text">OR</span>
      </div>

      {/* ── File Upload Dropzone ── */}
      <div
        className={`upload-zone ${isDragging ? 'upload-zone--dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleFileUpload}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={32} className="upload-icon" />
        <h3 className="upload-title">Upload a Local PRD</h3>
        <p className="upload-subtitle">Drag and drop or click to browse (PDF, DOCX, MD)</p>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".pdf,.docx,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
          onChange={handleFileUpload}
        />
      </div>

      {/* ── Status Banners ── */}
      {error && (
        <div className="status-banner status-banner--error" role="alert">
          <span className="status-banner-icon">✕</span>
          {error}
        </div>
      )}

      {result && (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}
        >
          <div
            className="status-banner status-banner--success"
            role="status"
            style={{ marginBottom: 0 }}
          >
            <span className="status-banner-icon">✓</span>
            Saved to <strong>{result.filePath}</strong>
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <Link
              href={`/review/${result.pageId}`}
              className="btn-primary"
              style={{ display: 'inline-block', width: 'auto' }}
            >
              Start PRD Review →
            </Link>
          </div>
        </div>
      )}

      {/* ── Preview Panel ── */}
      {loading && (
        <div className="preview-panel">
          <div className="preview-header">
            <span className="preview-title">Loading preview…</span>
          </div>
          <div className="skeleton-container">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>
      )}

      {result && (
        <div className="preview-panel">
          <div className="preview-header">
            <span className="preview-title">📄 {result.title}</span>
            <div className="preview-meta">
              <span className="preview-meta-item">Space: {result.spaceKey}</span>
              <span className="preview-meta-item">v{result.version}</span>
              <span className="preview-meta-item">ID: {result.pageId}</span>
            </div>
          </div>
          <div className="preview-body">
            <pre>{result.markdown}</pre>
          </div>
        </div>
      )}

      {!loading && !result && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📑</div>
          <p className="empty-state-text">
            Paste a Confluence page URL or ID above to fetch and stage a PRD.
          </p>
          <p className="empty-state-hint">
            The markdown will be saved to the <code>prds/</code> directory.
          </p>
        </div>
      )}
    </div>
  );
}
