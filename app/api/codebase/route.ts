import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.vscode',
  '.idea'
]);

const IMPORTANT_FILES = new Set([
  'readme.md',
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.ts',
  'vite.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts'
]);

// Helper to recursively get directory structure (up to maxDepth)
function getDirectoryStructure(dirPath: string, basePath: string, depth = 0, maxDepth = 3): string {
  if (depth > maxDepth) return '';

  let structure = '';
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
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

// Helper to extract content of important files at root
function getImportantFileContents(basePath: string): string {
  let contents = '\n--- Important Context Files ---\n';
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && IMPORTANT_FILES.has(entry.name.toLowerCase())) {
        const fullPath = path.join(basePath, entry.name);
        try {
          const fileContent = fs.readFileSync(fullPath, 'utf-8');
          // Truncate file contents if they are extremely long
          const truncatedContent = fileContent.length > 5000 
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { absolutePath } = body;

    if (!absolutePath || typeof absolutePath !== 'string') {
      return NextResponse.json(
        { error: 'absolutePath is required and must be a string' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json(
        { error: 'Directory does not exist at the provided path' },
        { status: 404 }
      );
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isDirectory()) {
      return NextResponse.json(
        { error: 'Provided path is not a directory' },
        { status: 400 }
      );
    }

    const structure = getDirectoryStructure(absolutePath, absolutePath, 0, 3);
    const fileContents = getImportantFileContents(absolutePath);
    
    const contextString = `Codebase Directory Structure (max depth 3):\n\n${structure}\n${fileContents}`;

    return NextResponse.json({ context: contextString });
  } catch (error) {
    console.error('Codebase API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
