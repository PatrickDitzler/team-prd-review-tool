import { NextResponse } from 'next/server';
import { evaluatePBIs } from '@/lib/core/evaluate';
import type { LLMSettings } from '@/lib/core/types';

export const maxDuration = 300; // 5 minutes max since this does multiple parallel AI calls

export async function POST(req: Request) {
  try {
    const {
      prdContext,
      breakdownContext,
      codebaseContext,
      settings,
      customPrompts,
    }: {
      prdContext: string;
      breakdownContext: string;
      codebaseContext: string;
      settings: LLMSettings;
      customPrompts?: Record<string, string>;
    } = await req.json();

    if (!prdContext || !breakdownContext || !settings) {
      return NextResponse.json({ error: 'Missing contexts or settings' }, { status: 400 });
    }

    const pbis = await evaluatePBIs(
      prdContext,
      breakdownContext,
      codebaseContext,
      settings,
      customPrompts,
    );

    return NextResponse.json({ pbis });
  } catch (error) {
    console.error('Error in Swarm Evaluator:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown evaluation error' },
      { status: 500 },
    );
  }
}
