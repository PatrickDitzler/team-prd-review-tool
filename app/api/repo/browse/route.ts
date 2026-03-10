import { NextResponse } from 'next/server';
import { listPRDFiles } from '@/lib/core/repo-browser';

export async function POST(req: Request) {
  try {
    const { repoPath, extensions } = await req.json();

    if (!repoPath || typeof repoPath !== 'string') {
      return NextResponse.json(
        { error: 'repoPath is required and must be a string' },
        { status: 400 },
      );
    }

    const files = listPRDFiles(repoPath, { extensions });
    return NextResponse.json({ files });
  } catch (error) {
    console.error('Repo browse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
