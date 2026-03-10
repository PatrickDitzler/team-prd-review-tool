import { NextResponse } from 'next/server';
import { ingestFromLocalRepo, ingestFromAzureRepo } from '@/lib/core/ingest';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { source } = body;

    if (!source || !source.method) {
      return NextResponse.json(
        { error: 'source.method is required (repo-local or repo-azure-devops)' },
        { status: 400 },
      );
    }

    if (source.method === 'repo-local') {
      const { repoPath, filePath } = source;
      if (!repoPath || !filePath) {
        return NextResponse.json(
          { error: 'repoPath and filePath are required for local repo ingestion' },
          { status: 400 },
        );
      }
      const result = await ingestFromLocalRepo(repoPath, filePath);
      return NextResponse.json(result);
    }

    if (source.method === 'repo-azure-devops') {
      const { org, project, repoName, filePath, branch, pat } = source;
      if (!org || !project || !repoName || !filePath || !pat) {
        return NextResponse.json(
          { error: 'org, project, repoName, filePath, and pat are required for Azure repo ingestion' },
          { status: 400 },
        );
      }
      const result = await ingestFromAzureRepo(
        org,
        project,
        repoName,
        filePath,
        branch || 'main',
        pat,
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: `Unsupported source method: ${source.method}` },
      { status: 400 },
    );
  } catch (error) {
    console.error('Repo ingest error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
