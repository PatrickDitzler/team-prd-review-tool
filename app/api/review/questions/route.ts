import { NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getLLMProvider, LLMSettings } from '@/lib/llm-provider';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { markdown, type, settings, customPrompts }: { markdown: string; type: 'qa' | 'eng' | 'design'; settings: LLMSettings, customPrompts?: Record<string, string> } = await req.json();

    if (!markdown || !settings || !type) {
      return NextResponse.json({ error: 'Missing markdown, type, or settings' }, { status: 400 });
    }

    if (settings.provider === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (type === 'qa') {
        return NextResponse.json({
          questions: [
            { text: 'What happens if the user tries to submit the form while offline?', priority: 'high' },
            { text: 'Are there any specific browser compatibility requirements for this new layout?', priority: 'medium' },
            { text: 'How should the system behave if the third-party API returns a 500 status code?', priority: 'high' }
          ]
        });
      } else if (type === 'eng') {
        return NextResponse.json({
          questions: [
            { text: 'Should we use a relational DB or NoSQL for storing these new event logs?', priority: 'high' },
            { text: 'Do we need to implement rate limiting on the new public endpoint?', priority: 'high' },
            { text: 'How does this new authentication flow interact with legacy user sessions?', priority: 'medium' }
          ]
        });
      } else {
        return NextResponse.json({
          questions: [
            { text: 'How should this new component behave on mobile viewports (< 768px)?', priority: 'high' },
            { text: 'Are there specific keyboard navigation or accessibility (a11y) requirements for this interactive element?', priority: 'high' },
            { text: 'What are the empty, loading, and error states for this new dashboard widget?', priority: 'medium' }
          ]
        });
      }
    }

    const model = getLLMProvider(settings);

    const defaultPrompt = `Analyze the following Product Requirements Document (PRD) and generate critical questions on behalf of ${type === 'qa' ? 'QA' : type === 'eng' ? 'Engineering' : 'Product Design'} to help the team review and refine the features.`;
    const promptKey = type === 'qa' ? 'qa_generation' : type === 'eng' ? 'eng_generation' : 'design_generation';
    const activePrompt = customPrompts?.[promptKey] ? customPrompts[promptKey] : defaultPrompt;

    const { object } = await generateObject({
      model,
      schema: z.object({
        questions: z
          .array(z.object({
            text: z.string().describe('The question text.'),
            priority: z.enum(['low', 'medium', 'high']).describe('The priority / influence this question has for breaking down and scoping the work.')
          }))
          .describe(type === 'qa' 
            ? '3 to 5 critical QA questions regarding testing strategy, edge cases, and missing requirements.'
            : type === 'eng'
            ? '3 to 5 critical Engineering questions regarding architecture, technical feasibility, constraints, or missing data structures.'
            : '3 to 5 critical UX/UI Design questions regarding user flows, accessibility, responsiveness, mobile views, empty states, or error handling.'),
      }),
      prompt: `${activePrompt}\n\nPRD:\n${markdown}`,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate questions' },
      { status: 500 }
    );
  }
}
