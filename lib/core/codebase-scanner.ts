import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.vscode',
  '.idea',
]);

const IMPORTANT_FILES = new Set([
  'readme.md',
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.ts',
  'vite.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDirectoryStructure(dirPath: string, basePath: string, depth = 0, maxDepth = 3): string {
  if (depth > maxDepth) return '';

  let structure = '';
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const indent = '  '.repeat(depth);

      if (entry.isDirectory()) {
        structure += `${indent}📁 ${entry.name}/\n`;
        structure += getDirectoryStructure(fullPath, basePath, depth + 1, maxDepth);
      } else {
        structure += `${indent}📄 ${entry.name}\n`;
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err);
  }

  return structure;
}

function getImportantFileContents(basePath: string): string {
  let contents = '\n--- Important Context Files ---\n';
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && IMPORTANT_FILES.has(entry.name.toLowerCase())) {
        const fullPath = path.join(basePath, entry.name);
        try {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          const truncatedContent =
            fileContent.length > 5000
              ? fileContent.substring(0, 5000) + '\n...[truncated_due_to_length]'
              : fileContent;

          contents += `\nFile: ${entry.name}\n\`\`\`\n${truncatedContent}\n\`\`\`\n`;
        } catch (err) {
          console.error(`Error reading file ${fullPath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading base directory ${basePath}:`, err);
  }
  return contents;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scanCodebase(absolutePath: string): string {
  if (!fs.existsSync(absolutePath)) {
    throw new Error('Directory does not exist at the provided path.');
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error('Provided path is not a directory.');
  }

  const structure = getDirectoryStructure(absolutePath, absolutePath, 0, 3);
  const fileContents = getImportantFileContents(absolutePath);

  return `Codebase Directory Structure (max depth 3):\n\n${structure}\n${fileContents}`;
}
