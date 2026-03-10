import { streamText } from 'ai';
import { getLLMProvider } from '@/lib/llm-provider';
import type { LLMSettings } from './types';

// ---------------------------------------------------------------------------
// Mock breakdown
// ---------------------------------------------------------------------------

const MOCK_BREAKDOWN = `### Phase 1: Core Foundation
- [ ] Set up project repository and CI/CD pipelines
- [ ] Initialize the database schema and migration scripts
- [ ] Implement secure authentication and user routing

### Phase 2: Feature Implementation
- [ ] Build the frontend components according to design
- [ ] Integrate with the third-party legacy APIs
- [ ] Implement rate-limiting and robust error handling

### Phase 3: Quality Assurance & Launch
- [ ] Write integration and end-to-end testing suites
- [ ] Configure Datadog tracking and performance monitors
- [ ] Deploy to staging for UAT before production rollout

*(This is a simulated mock breakdown based on your team notes!)*
`;

// ---------------------------------------------------------------------------
// Core — streaming generator
// ---------------------------------------------------------------------------

export async function* generateBreakdownStream(
  markdown: string,
  teamNotes: string,
  settings: LLMSettings,
  customPrompts?: Record<string, string>,
): AsyncGenerator<string> {
  // Mock mode
  if (settings.provider === 'mock') {
    const words = MOCK_BREAKDOWN.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return;
  }

  const model = getLLMProvider(settings);

  const defaultPrompt =
    `Based on the following Product Requirements Document (PRD) and the Team Notes collected during the review session, generate a high-level breakdown of the work required.\n\n` +
    `Focus on generating logical concepts, epics, or major components that need to be built. Do not focus on specific repositories yet. Just clean, high-level structural concepts to break the work down.\n\n` +
    `### PRD:\n${markdown}\n\n` +
    `### Team Notes & Comments:\n${teamNotes || 'None provided.'}\n\n` +
    `### Goal:\nProvide a clean, well-formatted markdown response detailing the high-level breakdown.`;

  const activePrompt = customPrompts?.breakdown_generation
    ? `${customPrompts.breakdown_generation}\n\n### PRD:\n${markdown}\n\n### Team Notes & Comments:\n${teamNotes || 'None provided.'}`
    : defaultPrompt;

  const result = streamText({
    model,
    prompt: activePrompt,
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
}

// ---------------------------------------------------------------------------
// Non-streaming convenience (for CLI batch mode)
// ---------------------------------------------------------------------------

export async function generateBreakdown(
  markdown: string,
  teamNotes: string,
  settings: LLMSettings,
  customPrompts?: Record<string, string>,
): Promise<string> {
  let full = '';
  for await (const chunk of generateBreakdownStream(markdown, teamNotes, settings, customPrompts)) {
    full += chunk;
  }
  return full;
}
