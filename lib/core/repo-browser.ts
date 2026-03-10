import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRDFileEntry {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PRD_EXTENSIONS = new Set(['.md', '.pdf', '.docx', '.txt']);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.vscode',
  '.idea',
  '__pycache__',
  '.cache',
  'vendor',
]);

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Recursively list files in a repo that match PRD-like extensions.
 * Ignores common infrastructure directories (node_modules, .git, etc.).
 */
export function listPRDFiles(
  repoPath: string,
  options?: { extensions?: string[]; maxDepth?: number },
): PRDFileEntry[] {
  const resolvedPath = path.resolve(repoPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Directory does not exist: ${resolvedPath}`);
  }
  if (!fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`Not a directory: ${resolvedPath}`);
  }

  const allowedExtensions =
    options?.extensions
      ? new Set(options.extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)))
      : DEFAULT_PRD_EXTENSIONS;

  const maxDepth = options?.maxDepth ?? 5;
  const results: PRDFileEntry[] = [];

  function walk(dirPath: string, depth: number) {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.has(ext)) {
          try {
            const stat = fs.statSync(fullPath);
            results.push({
              relativePath: path.relative(resolvedPath, fullPath),
              absolutePath: fullPath,
              extension: ext,
              sizeBytes: stat.size,
            });
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  walk(resolvedPath, 0);
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
