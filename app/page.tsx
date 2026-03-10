'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Settings,
  Upload,
  Globe,
  FolderGit2,
  Gamepad2,
  ArrowLeft,
  Search,
  Cloud,
  HardDrive,
  FileText,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FetchResult {
  title: string;
  markdown: string;
  stagedFilePath: string;
  pageId: string;
  source: {
    method: string;
    spaceKey?: string;
    version?: number;
    confluencePageId?: string;
    originalFileName?: string;
    repoPath?: string;
    filePathInRepo?: string;
    org?: string;
    project?: string;
    repoName?: string;
    filePath?: string;
    branch?: string;
  };
}

interface PRDFileEntry {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
}

interface AzureRepo {
  id: string;
  name: string;
  defaultBranch: string;
  webUrl: string;
}

interface AzureRepoItem {
  path: string;
  isFolder: boolean;
}

type SourceMethod = 'confluence' | 'upload' | 'repo' | 'demo' | null;
type RepoSubMethod = 'local' | 'azure-devops' | null;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  // Source selection state
  const [selectedMethod, setSelectedMethod] = useState<SourceMethod>(null);
  const [repoSubMethod, setRepoSubMethod] = useState<RepoSubMethod>(null);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Confluence state
  const [confluenceInput, setConfluenceInput] = useState('');

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local repo state
  const [repoPath, setRepoPath] = useState('');
  const [repoPRDFiles, setRepoPRDFiles] = useState<PRDFileEntry[]>([]);
  const [browsingRepo, setBrowsingRepo] = useState(false);

  // Azure DevOps repo state
  const [azureOrg, setAzureOrg] = useState('');
  const [azureProject, setAzureProject] = useState('');
  const [azurePat, setAzurePat] = useState('');
  const [azureRepos, setAzureRepos] = useState<AzureRepo[]>([]);
  const [selectedAzureRepo, setSelectedAzureRepo] = useState<AzureRepo | null>(null);
  const [azureItems, setAzureItems] = useState<AzureRepoItem[]>([]);
  const [browsingAzure, setBrowsingAzure] = useState(false);
  const [azureStep, setAzureStep] = useState<'credentials' | 'repos' | 'files'>('credentials');

  // ── Helpers ────────────────────────────────────────────────────────

  function resetState() {
    setSelectedMethod(null);
    setRepoSubMethod(null);
    setResult(null);
    setError(null);
    setRepoPRDFiles([]);
    setAzureRepos([]);
    setSelectedAzureRepo(null);
    setAzureItems([]);
    setAzureStep('credentials');
  }

  function storeRepoContext(ctx: Record<string, unknown>) {
    localStorage.setItem('repo_context', JSON.stringify(ctx));
  }

  // ── Confluence ─────────────────────────────────────────────────────

  async function handleConfluenceFetch(overrideInput?: string) {
    const fetchTarget = overrideInput || confluenceInput;
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
      if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  // ── File Upload ────────────────────────────────────────────────────

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
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Local Repo Browse ──────────────────────────────────────────────

  async function handleBrowseRepo() {
    if (!repoPath.trim()) return;

    setBrowsingRepo(true);
    setError(null);
    setRepoPRDFiles([]);

    try {
      const res = await fetch('/api/repo/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: repoPath.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to browse repo');
      setRepoPRDFiles(data.files || []);
      if ((data.files || []).length === 0) {
        setError('No PRD files (.md, .pdf, .docx, .txt) found in the repository.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse repo');
    } finally {
      setBrowsingRepo(false);
    }
  }

  async function handleSelectRepoFile(file: PRDFileEntry) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/repo/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: { method: 'repo-local', repoPath: repoPath.trim(), filePath: file.relativePath },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ingest repo file');
      setResult(data);
      storeRepoContext({ type: 'local', label: repoPath.trim(), localPath: repoPath.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest file');
    } finally {
      setLoading(false);
    }
  }

  // ── Azure DevOps Repo ──────────────────────────────────────────────

  async function handleListAzureRepos() {
    if (!azureOrg.trim() || !azureProject.trim() || !azurePat.trim()) return;

    setBrowsingAzure(true);
    setError(null);

    try {
      const res = await fetch('/api/azure-repos/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org: azureOrg.trim(), project: azureProject.trim(), pat: azurePat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to list repos');
      setAzureRepos(data.repos || []);
      setAzureStep('repos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Azure DevOps');
    } finally {
      setBrowsingAzure(false);
    }
  }

  async function handleSelectAzureRepo(repo: AzureRepo) {
    setSelectedAzureRepo(repo);
    setBrowsingAzure(true);
    setError(null);

    try {
      const res = await fetch('/api/azure-repos/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org: azureOrg.trim(),
          project: azureProject.trim(),
          repoId: repo.id,
          pat: azurePat,
          branch: repo.defaultBranch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to list files');
      // Filter to PRD-like files only
      const prdExtensions = ['.md', '.pdf', '.docx', '.txt'];
      const prdItems = (data.items || []).filter(
        (item: AzureRepoItem) =>
          !item.isFolder &&
          prdExtensions.some((ext) => item.path.toLowerCase().endsWith(ext)),
      );
      setAzureItems(prdItems);
      setAzureStep('files');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse repo files');
    } finally {
      setBrowsingAzure(false);
    }
  }

  async function handleSelectAzureFile(item: AzureRepoItem) {
    if (!selectedAzureRepo) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/repo/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: {
            method: 'repo-azure-devops',
            org: azureOrg.trim(),
            project: azureProject.trim(),
            repoName: selectedAzureRepo.id,
            filePath: item.path,
            branch: selectedAzureRepo.defaultBranch,
            pat: azurePat,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ingest Azure repo file');
      setResult(data);
      storeRepoContext({
        type: 'azure-devops',
        label: `${azureOrg}/${azureProject}/${selectedAzureRepo.name}`,
        org: azureOrg.trim(),
        project: azureProject.trim(),
        repoName: selectedAzureRepo.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest file');
    } finally {
      setLoading(false);
    }
  }

  // ── Demo ───────────────────────────────────────────────────────────

  async function handleDemo() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/confluence/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: 'demo' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Demo failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Render Helpers ─────────────────────────────────────────────────

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Render ─────────────────────────────────────────────────────────

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
          Fetch PRDs from Confluence, upload a file, or pull from a repository — then review with
          your team.
        </p>
      </header>

      {/* ── Method Selection Cards ── */}
      {!selectedMethod && !result && (
        <div className="source-selector">
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '16px',
              color: 'var(--color-text)',
              textAlign: 'center',
            }}
          >
            How would you like to provide the PRD?
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              maxWidth: '800px',
              margin: '0 auto',
            }}
          >
            <button
              id="source-confluence"
              className="source-card"
              onClick={() => setSelectedMethod('confluence')}
            >
              <Globe size={28} className="source-card-icon" style={{ color: '#2563eb' }} />
              <span className="source-card-title">Confluence</span>
              <span className="source-card-desc">Fetch from a Confluence page URL or ID</span>
            </button>

            <button
              id="source-upload"
              className="source-card"
              onClick={() => setSelectedMethod('upload')}
            >
              <Upload size={28} className="source-card-icon" style={{ color: '#059669' }} />
              <span className="source-card-title">Upload File</span>
              <span className="source-card-desc">Upload a PDF, DOCX, or Markdown file</span>
            </button>

            <button
              id="source-repo"
              className="source-card"
              onClick={() => setSelectedMethod('repo')}
            >
              <FolderGit2 size={28} className="source-card-icon" style={{ color: '#9333ea' }} />
              <span className="source-card-title">From Repository</span>
              <span className="source-card-desc">
                Pick a PRD from a local or Azure DevOps repo
              </span>
            </button>

            <button id="source-demo" className="source-card" onClick={() => handleDemo()}>
              <Gamepad2 size={28} className="source-card-icon" style={{ color: '#f59e0b' }} />
              <span className="source-card-title">Demo</span>
              <span className="source-card-desc">Try with a sample PRD (no API needed)</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Back Button ── */}
      {selectedMethod && !result && (
        <button
          className="btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            width: 'auto',
            margin: '0 0 16px 0',
            padding: '6px 12px',
            fontSize: '13px',
          }}
          onClick={resetState}
        >
          <ArrowLeft size={14} /> Back to Source Selection
        </button>
      )}

      {/* ── Confluence Panel ── */}
      {selectedMethod === 'confluence' && !result && (
        <div className="fetch-card fade-in">
          <label htmlFor="confluence-input" className="fetch-card-label">
            Confluence Page
          </label>
          <div className="fetch-input-row">
            <input
              id="confluence-input"
              className="fetch-input"
              type="text"
              placeholder="Paste a Confluence URL or page ID…"
              value={confluenceInput}
              onChange={(e) => setConfluenceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) handleConfluenceFetch();
              }}
              disabled={loading}
              autoComplete="off"
            />
            <button
              id="fetch-button"
              className="fetch-button"
              onClick={() => handleConfluenceFetch()}
              disabled={loading || !confluenceInput.trim()}
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
      )}

      {/* ── Upload Panel ── */}
      {selectedMethod === 'upload' && !result && (
        <div
          className={`upload-zone fade-in ${isDragging ? 'upload-zone--dragging' : ''}`}
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
      )}

      {/* ── Repository Panel ── */}
      {selectedMethod === 'repo' && !result && (
        <div className="fetch-card fade-in">
          {/* Sub-method selection */}
          {!repoSubMethod && (
            <div>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  marginBottom: '16px',
                  color: 'var(--color-text)',
                }}
              >
                Choose Repository Source
              </h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  id="repo-local"
                  className="source-card"
                  style={{ flex: '1 1 200px' }}
                  onClick={() => setRepoSubMethod('local')}
                >
                  <HardDrive size={24} className="source-card-icon" style={{ color: '#6366f1' }} />
                  <span className="source-card-title">Local Repository</span>
                  <span className="source-card-desc">Browse PRD files on your local machine</span>
                </button>
                <button
                  id="repo-azure"
                  className="source-card"
                  style={{ flex: '1 1 200px' }}
                  onClick={() => setRepoSubMethod('azure-devops')}
                >
                  <Cloud size={24} className="source-card-icon" style={{ color: '#0078d4' }} />
                  <span className="source-card-title">Azure DevOps Repo</span>
                  <span className="source-card-desc">Browse PRDs in an Azure DevOps Git repo</span>
                </button>
              </div>
            </div>
          )}

          {/* Local Repo Browser */}
          {repoSubMethod === 'local' && (
            <div className="fade-in">
              <button
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: 'auto',
                  margin: '0 0 12px 0',
                  padding: '4px 10px',
                  fontSize: '12px',
                }}
                onClick={() => {
                  setRepoSubMethod(null);
                  setRepoPRDFiles([]);
                  setError(null);
                }}
              >
                <ArrowLeft size={12} /> Back
              </button>
              <label
                className="fetch-card-label"
                style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}
              >
                Local Repository Path (Absolute)
              </label>
              <div className="fetch-input-row">
                <input
                  type="text"
                  className="fetch-input"
                  placeholder="/Users/name/Projects/my-app"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBrowseRepo();
                  }}
                  disabled={browsingRepo}
                />
                <button
                  className="fetch-button"
                  onClick={handleBrowseRepo}
                  disabled={browsingRepo || !repoPath.trim()}
                >
                  {browsingRepo ? (
                    <>
                      <span className="spinner" /> Scanning…
                    </>
                  ) : (
                    <>
                      <Search size={16} /> Browse PRDs
                    </>
                  )}
                </button>
              </div>

              {repoPRDFiles.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-text-muted)',
                      marginBottom: '8px',
                    }}
                  >
                    Found {repoPRDFiles.length} PRD file(s) — click to select:
                  </p>
                  <div
                    style={{
                      maxHeight: '300px',
                      overflow: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {repoPRDFiles.map((file) => (
                      <button
                        key={file.relativePath}
                        className="repo-file-row"
                        onClick={() => handleSelectRepoFile(file)}
                        disabled={loading}
                      >
                        <FileText size={16} style={{ flexShrink: 0 }} />
                        <span className="repo-file-path">{file.relativePath}</span>
                        <span className="repo-file-size">{formatFileSize(file.sizeBytes)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Azure DevOps Repo Browser */}
          {repoSubMethod === 'azure-devops' && (
            <div className="fade-in">
              <button
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: 'auto',
                  margin: '0 0 12px 0',
                  padding: '4px 10px',
                  fontSize: '12px',
                }}
                onClick={() => {
                  setRepoSubMethod(null);
                  setAzureRepos([]);
                  setSelectedAzureRepo(null);
                  setAzureItems([]);
                  setAzureStep('credentials');
                  setError(null);
                }}
              >
                <ArrowLeft size={12} /> Back
              </button>

              {azureStep === 'credentials' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      Organization
                    </label>
                    <input
                      className="form-input"
                      placeholder="e.g. contoso"
                      value={azureOrg}
                      onChange={(e) => setAzureOrg(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      Project
                    </label>
                    <input
                      className="form-input"
                      placeholder="e.g. MyProject"
                      value={azureProject}
                      onChange={(e) => setAzureProject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      Personal Access Token (PAT)
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Your PAT with Code (Read) scope"
                      value={azurePat}
                      onChange={(e) => setAzurePat(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', alignSelf: 'flex-end' }}
                    onClick={handleListAzureRepos}
                    disabled={
                      browsingAzure ||
                      !azureOrg.trim() ||
                      !azureProject.trim() ||
                      !azurePat.trim()
                    }
                  >
                    {browsingAzure ? (
                      <>
                        <span className="spinner" /> Connecting…
                      </>
                    ) : (
                      'Connect & List Repos'
                    )}
                  </button>
                </div>
              )}

              {azureStep === 'repos' && (
                <div>
                  <button
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: 'auto',
                      margin: '0 0 12px 0',
                      padding: '4px 10px',
                      fontSize: '12px',
                    }}
                    onClick={() => {
                      setAzureStep('credentials');
                      setAzureRepos([]);
                    }}
                  >
                    <ArrowLeft size={12} /> Back to Credentials
                  </button>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-text-muted)',
                      marginBottom: '8px',
                    }}
                  >
                    Select a repository:
                  </p>
                  <div
                    style={{
                      maxHeight: '300px',
                      overflow: 'auto',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {azureRepos.map((repo) => (
                      <button
                        key={repo.id}
                        className="repo-file-row"
                        onClick={() => handleSelectAzureRepo(repo)}
                        disabled={browsingAzure}
                      >
                        <FolderGit2 size={16} style={{ flexShrink: 0, color: '#9333ea' }} />
                        <span className="repo-file-path">{repo.name}</span>
                        <span className="repo-file-size">{repo.defaultBranch}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {azureStep === 'files' && selectedAzureRepo && (
                <div>
                  <button
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: 'auto',
                      margin: '0 0 12px 0',
                      padding: '4px 10px',
                      fontSize: '12px',
                    }}
                    onClick={() => {
                      setAzureStep('repos');
                      setAzureItems([]);
                      setSelectedAzureRepo(null);
                    }}
                  >
                    <ArrowLeft size={12} /> Back to Repos
                  </button>
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--color-text-muted)',
                      marginBottom: '8px',
                    }}
                  >
                    PRD files in <strong>{selectedAzureRepo.name}</strong> — click to select:
                  </p>
                  {azureItems.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      No PRD files (.md, .pdf, .docx, .txt) found in this repository.
                    </p>
                  ) : (
                    <div
                      style={{
                        maxHeight: '300px',
                        overflow: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {azureItems.map((item) => (
                        <button
                          key={item.path}
                          className="repo-file-row"
                          onClick={() => handleSelectAzureFile(item)}
                          disabled={loading}
                        >
                          <FileText size={16} style={{ flexShrink: 0 }} />
                          <span className="repo-file-path">{item.path}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            Saved to <strong>{result.stagedFilePath}</strong>
          </div>
          <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
            <button
              className="btn-secondary"
              style={{ width: 'auto' }}
              onClick={resetState}
            >
              Start Over
            </button>
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

      {/* ── Loading State ── */}
      {loading && (
        <div className="preview-panel">
          <div className="preview-header">
            <span className="preview-title">Loading…</span>
          </div>
          <div className="skeleton-container">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>
      )}

      {/* ── Preview Panel ── */}
      {result && (
        <div className="preview-panel">
          <div className="preview-header">
            <span className="preview-title">📄 {result.title}</span>
            <div className="preview-meta">
              {result.source.method === 'confluence' && (
                <>
                  <span className="preview-meta-item">Space: {result.source.spaceKey}</span>
                  <span className="preview-meta-item">v{result.source.version}</span>
                </>
              )}
              {result.source.method === 'upload' && (
                <span className="preview-meta-item">
                  Uploaded: {result.source.originalFileName}
                </span>
              )}
              {result.source.method === 'repo-local' && (
                <span className="preview-meta-item">
                  Repo: {result.source.filePathInRepo}
                </span>
              )}
              {result.source.method === 'repo-azure-devops' && (
                <span className="preview-meta-item">
                  Azure: {result.source.repoName}/{result.source.filePath}
                </span>
              )}
              <span className="preview-meta-item">Source: {result.source.method}</span>
              <span className="preview-meta-item">ID: {result.pageId}</span>
            </div>
          </div>
          <div className="preview-body">
            <pre>{result.markdown}</pre>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !result && !selectedMethod && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📑</div>
          <p className="empty-state-text">Choose a source above to get started.</p>
          <p className="empty-state-hint">
            The PRD will be staged as Markdown in the <code>prds/</code> directory.
          </p>
        </div>
      )}
    </div>
  );
}
