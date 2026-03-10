import { generateBreakdownStream } from '@/lib/core/breakdown';
import type { LLMSettings } from '@/lib/core/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const {
      markdown,
      teamNotes,
      settings,
      customPrompts,
    }: {
      markdown: string;
      teamNotes: string;
      settings: LLMSettings;
      customPrompts?: Record<string, string>;
    } = await req.json();

    if (!markdown || !settings) {
      return new Response(JSON.stringify({ error: 'Missing markdown or settings' }), {
        status: 400,
      });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateBreakdownStream(
            markdown,
            teamNotes,
            settings,
            customPrompts,
          )) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error generating breakdown:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to generate breakdown',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
