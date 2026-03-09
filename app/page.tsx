'use client';

import { useState } from 'react';

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

  async function handleFetch() {
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/confluence/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: input.trim() }),
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
            onClick={handleFetch}
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
      </div>

      {/* ── Status Banners ── */}
      {error && (
        <div className="status-banner status-banner--error" role="alert">
          <span className="status-banner-icon">✕</span>
          {error}
        </div>
      )}

      {result && (
        <div className="status-banner status-banner--success" role="status">
          <span className="status-banner-icon">✓</span>
          Saved to <strong>{result.filePath}</strong>
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
            <span className="preview-title">
              📄 {result.title}
            </span>
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
