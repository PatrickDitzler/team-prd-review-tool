import { promises as fs } from 'fs';
import path from 'path';
import { extractPageId, fetchConfluencePage, sanitizeFilename } from '@/lib/confluence';
import type { IngestResult } from './types';

// ---------------------------------------------------------------------------
// Demo PRD
// ---------------------------------------------------------------------------

const DEMO_MARKDOWN = `## Overview
The new User Dashboard aims to consolidate all metrics into a single, cohesive view. It replaces the legacy reporting portal and introduces real-time websockets.

## Goals
- Decrease load time of reporting by 40%
- Introduce customizable widgets
- Deprecate old REST endpoints by Q4

## Requirements
1. **Authentication:** Must integrate with existing Auth0 SSO.
2. **Real-time Data:** WebSockets must handle up to 500 events/sec.
3. **Responsive:** Dashboard must work on tablet and mobile viewports.

## Out of Scope
- Migrating historical data older than 1 year
- Admin billing views`;

export async function ingestDemo(): Promise<IngestResult> {
  const demoTitle = 'Demo User Dashboard PRD';
  const filename = 'demo.md';
  const prdsDir = path.join(process.cwd(), 'prds');
  await fs.mkdir(prdsDir, { recursive: true });
  const filePath = path.join(prdsDir, filename);

  const fileContent = `# ${demoTitle}\n\n> **Space:** DEMO · **Version:** 1 · **Page ID:** demo\n\n---\n\n${DEMO_MARKDOWN}`;
  await fs.writeFile(filePath, fileContent, 'utf-8');

  return {
    title: demoTitle,
    markdown: DEMO_MARKDOWN,
    stagedFilePath: `prds/${filename}`,
    pageId: 'demo',
    source: { method: 'demo' },
  };
}

// ---------------------------------------------------------------------------
// Confluence
// ---------------------------------------------------------------------------

export async function ingestFromConfluence(input: string): Promise<IngestResult> {
  const pageId = extractPageId(input);
  const page = await fetchConfluencePage(pageId);

  const prdsDir = path.join(process.cwd(), 'prds');
  await fs.mkdir(prdsDir, { recursive: true });

  const filename = `${sanitizeFilename(page.title)}.md`;
  const filePath = path.join(prdsDir, filename);

  const fileContent = `# ${page.title}\n\n> **Space:** ${page.spaceKey} · **Version:** ${page.version} · **Page ID:** ${page.id}\n\n---\n\n${page.markdown}`;
  await fs.writeFile(filePath, fileContent, 'utf-8');

  return {
    title: page.title,
    markdown: page.markdown,
    stagedFilePath: `prds/${filename}`,
    pageId: page.id,
    source: {
      method: 'confluence',
      spaceKey: page.spaceKey,
      version: page.version,
      confluencePageId: page.id,
    },
  };
}

// ---------------------------------------------------------------------------
// Local file
// ---------------------------------------------------------------------------

export async function ingestFromFile(filePath: string): Promise<IngestResult> {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  let extractedText = '';

  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    extractedText = pdfData.text;
  } else if (ext === '.docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value;
  } else if (ext === '.md' || ext === '.txt') {
    extractedText = buffer.toString('utf-8');
  } else {
    throw new Error('Unsupported file type. Please provide a PDF, DOCX, or Markdown file.');
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('Could not extract any text from the provided file.');
  }

  const pageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
  const prdsDir = path.join(process.cwd(), 'prds');
  await fs.mkdir(prdsDir, { recursive: true });

  const basename = path.basename(filePath);
  const mdPath = path.join(prdsDir, `${pageId}.md`);
  const formattedMarkdown = `# Uploaded Document: ${basename}\n\n${extractedText.replace(/\n{3,}/g, '\n\n')}`;
  await fs.writeFile(mdPath, formattedMarkdown, 'utf-8');

  return {
    title: basename,
    markdown: formattedMarkdown,
    stagedFilePath: mdPath,
    pageId,
    source: { method: 'upload', originalFileName: basename },
  };
}

// ---------------------------------------------------------------------------
// File from buffer (for web upload route)
// ---------------------------------------------------------------------------

export async function ingestFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<IngestResult> {
  let extractedText = '';

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(buffer);
    extractedText = pdfData.text;
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    extractedText = result.value;
  } else if (
    mimeType === 'text/markdown' ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.txt')
  ) {
    extractedText = buffer.toString('utf-8');
  } else {
    throw new Error('Unsupported file type. Please upload a PDF, DOCX, or Markdown file.');
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('Could not extract any text from the provided file.');
  }

  const pageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 9);
  const prdsDir = path.join(process.cwd(), 'prds');
  await fs.mkdir(prdsDir, { recursive: true });

  const mdPath = path.join(prdsDir, `${pageId}.md`);
  const formattedMarkdown = `# Uploaded Document: ${fileName}\n\n${extractedText.replace(/\n{3,}/g, '\n\n')}`;
  await fs.writeFile(mdPath, formattedMarkdown, 'utf-8');

  return {
    title: fileName,
    markdown: formattedMarkdown,
    stagedFilePath: mdPath,
    pageId,
    source: { method: 'upload', originalFileName: fileName },
  };
}

// ---------------------------------------------------------------------------
// Local repository file
// ---------------------------------------------------------------------------

export async function ingestFromLocalRepo(
  repoPath: string,
  fileRelativePath: string,
): Promise<IngestResult> {
  const absoluteFilePath = path.join(repoPath, fileRelativePath);

  try {
    await fs.access(absoluteFilePath);
  } catch {
    throw new Error(`File not found in repository: ${fileRelativePath}`);
  }

  const result = await ingestFromFile(absoluteFilePath);

  // Override the source metadata to indicate repo origin
  return {
    ...result,
    source: {
      method: 'repo-local',
      repoPath,
      filePathInRepo: fileRelativePath,
    },
  };
}

// ---------------------------------------------------------------------------
// Azure DevOps repository file
// ---------------------------------------------------------------------------

export async function ingestFromAzureRepo(
  org: string,
  project: string,
  repoName: string,
  filePath: string,
  branch: string,
  pat: string,
): Promise<IngestResult> {
  const { fetchFileContent } = await import('./azure-repos');

  const { content, fileName } = await fetchFileContent(
    org,
    project,
    repoName,
    pat,
    filePath,
    branch,
  );

  // Determine mime type from extension
  const ext = path.extname(fileName).toLowerCase();
  let mimeType = 'text/plain';
  if (ext === '.pdf') mimeType = 'application/pdf';
  else if (ext === '.docx')
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (ext === '.md') mimeType = 'text/markdown';

  const result = await ingestFromBuffer(content, fileName, mimeType);

  // Override the source metadata to indicate Azure DevOps repo origin
  return {
    ...result,
    source: {
      method: 'repo-azure-devops',
      org,
      project,
      repoName,
      filePath,
      branch,
    },
  };
}
