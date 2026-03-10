import { NextResponse } from 'next/server';
import { listRepos } from '@/lib/core/azure-repos';

export async function POST(req: Request) {
  try {
    const { org, project, pat } = await req.json();

    if (!org || !project || !pat) {
      return NextResponse.json(
        { error: 'org, project, and pat are all required' },
        { status: 400 },
      );
    }

    const repos = await listRepos(org, project, pat);
    return NextResponse.json({ repos });
  } catch (error) {
    console.error('Azure repos list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
