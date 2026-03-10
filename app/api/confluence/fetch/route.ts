import { NextRequest, NextResponse } from 'next/server';
import { ingestFromConfluence, ingestDemo } from '@/lib/core/ingest';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input: string = body.pageId || body.confluenceUrl;

    if (!input) {
      return NextResponse.json(
        { error: 'Provide a "pageId" or "confluenceUrl" in the request body.' },
        { status: 400 },
      );
    }

    if (input === 'demo') {
      const result = await ingestDemo();
      return NextResponse.json(result);
    }

    const result = await ingestFromConfluence(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('credentials')
      ? 500
      : message.includes('API error')
        ? 502
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
