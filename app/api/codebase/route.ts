import { NextResponse } from 'next/server';
import { scanCodebase } from '@/lib/core/codebase-scanner';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { absolutePath } = body;

    if (!absolutePath || typeof absolutePath !== 'string') {
      return NextResponse.json(
        { error: 'absolutePath is required and must be a string' },
        { status: 400 },
      );
    }

    const context = scanCodebase(absolutePath);
    return NextResponse.json({ context });
  } catch (error) {
    console.error('Codebase API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 },
    );
  }
}
