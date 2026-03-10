import { NextResponse } from 'next/server';
import { listItems } from '@/lib/core/azure-repos';

export async function POST(req: Request) {
  try {
    const { org, project, repoId, pat, scopePath, branch } = await req.json();

    if (!org || !project || !repoId || !pat) {
      return NextResponse.json(
        { error: 'org, project, repoId, and pat are all required' },
        { status: 400 },
      );
    }

    const items = await listItems(org, project, repoId, pat, scopePath, branch);
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Azure repos files error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
