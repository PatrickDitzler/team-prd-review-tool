import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { listPRDFiles } from '@/lib/core/repo-browser';

describe('listPRDFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-browser-test-'));

    // Create test directory structure
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'docs', 'nested'), { recursive: true });

    // Create files
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# README');
    await fs.writeFile(path.join(tmpDir, 'docs', 'prd.md'), '# PRD');
    await fs.writeFile(path.join(tmpDir, 'docs', 'spec.pdf'), 'fake-pdf');
    await fs.writeFile(path.join(tmpDir, 'docs', 'notes.txt'), 'notes');
    await fs.writeFile(path.join(tmpDir, 'docs', 'design.docx'), 'fake-docx');
    await fs.writeFile(path.join(tmpDir, 'docs', 'nested', 'deep.md'), '# Deep');
    await fs.writeFile(path.join(tmpDir, 'src', 'app.ts'), 'code');
    await fs.writeFile(path.join(tmpDir, '.git', 'config'), 'git');
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'pkg', 'readme.md'), 'pkg');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('finds PRD files with default extensions', () => {
    const files = listPRDFiles(tmpDir);
    const paths = files.map((f) => f.relativePath);

    expect(paths).toContain('README.md');
    expect(paths).toContain(path.join('docs', 'prd.md'));
    expect(paths).toContain(path.join('docs', 'spec.pdf'));
    expect(paths).toContain(path.join('docs', 'notes.txt'));
    expect(paths).toContain(path.join('docs', 'design.docx'));
    expect(paths).toContain(path.join('docs', 'nested', 'deep.md'));
  });

  it('excludes node_modules and .git directories', () => {
    const files = listPRDFiles(tmpDir);
    const paths = files.map((f) => f.relativePath);

    expect(paths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(paths.some((p) => p.includes('.git'))).toBe(false);
  });

  it('excludes non-PRD files', () => {
    const files = listPRDFiles(tmpDir);
    const paths = files.map((f) => f.relativePath);

    expect(paths.some((p) => p.endsWith('.ts'))).toBe(false);
  });

  it('filters by custom extensions', () => {
    const files = listPRDFiles(tmpDir, { extensions: ['.md'] });
    const paths = files.map((f) => f.relativePath);

    expect(paths).toContain('README.md');
    expect(paths).toContain(path.join('docs', 'prd.md'));
    expect(paths.some((p) => p.endsWith('.pdf'))).toBe(false);
    expect(paths.some((p) => p.endsWith('.txt'))).toBe(false);
  });

  it('returns sorted results', () => {
    const files = listPRDFiles(tmpDir);
    const paths = files.map((f) => f.relativePath);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  it('includes file size in results', () => {
    const files = listPRDFiles(tmpDir);
    for (const file of files) {
      expect(typeof file.sizeBytes).toBe('number');
      expect(file.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('returns empty array for empty directory', async () => {
    const emptyDir = path.join(tmpDir, 'empty');
    await fs.mkdir(emptyDir, { recursive: true });
    const files = listPRDFiles(emptyDir);
    expect(files).toEqual([]);
  });

  it('throws for non-existent directory', () => {
    expect(() => listPRDFiles('/non/existent/path')).toThrow('does not exist');
  });

  it('throws for a file path instead of directory', async () => {
    const filePath = path.join(tmpDir, 'README.md');
    expect(() => listPRDFiles(filePath)).toThrow('Not a directory');
  });

  it('respects maxDepth option', () => {
    const files = listPRDFiles(tmpDir, { maxDepth: 1 });
    const paths = files.map((f) => f.relativePath);

    // Should find files at depth 0 and 1
    expect(paths).toContain('README.md');
    expect(paths).toContain(path.join('docs', 'prd.md'));

    // Should NOT find files at depth 2
    expect(paths).not.toContain(path.join('docs', 'nested', 'deep.md'));
  });
});
