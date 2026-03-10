import { NextResponse } from 'next/server';
import { exportToAzureDevOps } from '@/lib/core/export';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pbis, config, prdContext } = body;

    const result = await exportToAzureDevOps(pbis, config, prdContext);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Azure Export Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export to Azure' },
      { status: 500 },
    );
  }
}
