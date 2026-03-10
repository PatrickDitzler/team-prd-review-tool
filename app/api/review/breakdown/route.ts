import { streamText } from 'ai';
import { getLLMProvider, LLMSettings } from '@/lib/llm-provider';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { markdown, teamNotes, settings, customPrompts }: { markdown: string; teamNotes: string; settings: LLMSettings, customPrompts?: Record<string, string> } = await req.json();

    if (!markdown || !settings) {
      return new Response(JSON.stringify({ error: 'Missing markdown or settings' }), { status: 400 });
    }

    if (settings.provider === 'mock') {
      const mockMarkdown = `### Phase 1: Core Foundation\n- [ ] Set up project repository and CI/CD pipelines\n- [ ] Initialize the database schema and migration scripts\n- [ ] Implement secure authentication and user routing\n\n### Phase 2: Feature Implementation\n- [ ] Build the frontend components according to design\n- [ ] Integrate with the third-party legacy APIs\n- [ ] Implement rate-limiting and robust error handling\n\n### Phase 3: Quality Assurance & Launch\n- [ ] Write integration and end-to-end testing suites\n- [ ] Configure Datadog tracking and performance monitors\n- [ ] Deploy to staging for UAT before production rollout\n\n*(This is a simulated mock breakdown based on your team notes!)*\n`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const words = mockMarkdown.split(' ');
          for (const word of words) {
            controller.enqueue(encoder.encode(word + ' '));
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const model = getLLMProvider(settings);

    const defaultPrompt = `Based on the following Product Requirements Document (PRD) and the Team Notes collected during the review session, generate a high-level breakdown of the work required.\n\n` +
      `Focus on generating logical concepts, epics, or major components that need to be built. Do not focus on specific repositories yet. Just clean, high-level structural concepts to break the work down.\n\n` +
      `### PRD:\n${markdown}\n\n` +
      `### Team Notes & Comments:\n${teamNotes || 'None provided.'}\n\n` +
      `### Goal:\nProvide a clean, well-formatted markdown response detailing the high-level breakdown.`;

    const activePrompt = customPrompts?.breakdown_generation ? `${customPrompts.breakdown_generation}\n\n### PRD:\n${markdown}\n\n### Team Notes & Comments:\n${teamNotes || 'None provided.'}` : defaultPrompt;

    const result = streamText({
      model,
      prompt: activePrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error generating breakdown:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate breakdown' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
