import { NextResponse } from 'next/server';
import { ingestFromBuffer } from '@/lib/core/ingest';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestFromBuffer(buffer, file.name, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error('File upload logic failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown upload error' },
      { status: 500 },
    );
  }
}
