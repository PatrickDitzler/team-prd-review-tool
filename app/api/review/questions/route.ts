import { NextResponse } from 'next/server';
import { generateReviewQuestions } from '@/lib/core/review';
import type { LLMSettings } from '@/lib/core/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const {
      markdown,
      type,
      settings,
      customPrompts,
    }: {
      markdown: string;
      type: 'qa' | 'eng' | 'design';
      settings: LLMSettings;
      customPrompts?: Record<string, string>;
    } = await req.json();

    if (!markdown || !settings || !type) {
      return NextResponse.json({ error: 'Missing markdown, type, or settings' }, { status: 400 });
    }

    const questions = await generateReviewQuestions(markdown, type, settings, customPrompts);
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate questions' },
      { status: 500 },
    );
  }
}
