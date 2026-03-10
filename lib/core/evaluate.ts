import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { getLLMProvider } from '@/lib/llm-provider';
import type { LLMSettings, EnhancedPBI } from './types';

// ---------------------------------------------------------------------------
// Mock response
// ---------------------------------------------------------------------------

const MOCK_PBIS: EnhancedPBI[] = [
  {
    description: 'Build the user registration API endpoint',
    functionalReqs:
      '- Accepts email and password\n- Hashes password using bcrypt\n- Returns JWT token',
    gherkin: 'Given a new user with valid email\nWhen they sign up\nThen an account is created',
    agentReviews: [
      {
        agentName: 'Cipher',
        role: 'Security',
        feedback: 'Looks good, but ensure rate limits are in place.',
      },
      {
        agentName: 'Atlas',
        role: 'Architect',
        feedback: 'Store the users in the `users` table with a unique constraint on email.',
      },
      {
        agentName: 'BugSmasher',
        role: 'QA',
        feedback: 'Need to test with empty passwords and invalid email formats.',
      },
      {
        agentName: 'Justice',
        role: 'Compliance',
        feedback: 'Ensure we have a checkbox for terms of service consent.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function evaluatePBIs(
  prdContext: string,
  breakdownContext: string,
  codebaseContext: string,
  settings: LLMSettings,
  customPrompts?: Record<string, string>,
): Promise<EnhancedPBI[]> {
  // Mock mode
  if (settings.provider === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return MOCK_PBIS;
  }

  const modelObj = getLLMProvider(settings);

  // Step 1: Generate Enhanced PBIs from the PRD and Breakdown
  const { object: pbiData } = await generateObject({
    model: modelObj,
    schema: z.object({
      pbis: z
        .array(
          z.object({
            description: z
              .string()
              .describe('A high level summary and scope of the Product Backlog Item'),
            functionalReqs: z
              .string()
              .describe('Markdown bulleted list of functional requirements for this PBI'),
            gherkin: z.string().describe('Gherkin style Acceptance Criteria (Given/When/Then)'),
          }),
        )
        .describe('List of Product Backlog Items broken down from the provided context'),
    }),
    prompt: `Based on the following PRD and specific Team Breakdown Context, extract the actual backlog items (PBIs) that need to be developed. For each PBI, provide a distinct Description, Functional Requirements list, and Gherkin-style Acceptance Criteria. Keep PBIs appropriately scoped. Do not generate more than 3-4 PBIs to keep the scope reasonable.

      PRD Context:
      ${prdContext.slice(0, 5000)}

      Breakdown Context:
      ${breakdownContext}
      `,
  });

  const evaluatedPBIs: EnhancedPBI[] = [];

  // Step 2: For each PBI, run the Swarm
  for (const pbi of pbiData.pbis) {
    const pbiContextBlock = `
      PBI Description: ${pbi.description}
      Functional Reqs: ${pbi.functionalReqs}
      Acceptance Criteria: ${pbi.gherkin}
      `;

    const createAgentPrompt = (rolePrompt: string, overridePrompt?: string) => `
      You are a senior team member reviewing a Product Backlog Item before development begins.
      
      ${overridePrompt ? `USER CUSTOM INSTRUCTIONS: ${overridePrompt}` : `Your specific persona is: ${rolePrompt}`}
      
      Review the PBI against your specialty. Provide constructive feedback, point out missing constraints, and reference the codebase structure if relevant. If it looks perfect, say so. Keep your feedback to 2-3 concise paragraphs of Markdown.
      
      CODEBASE CONTEXT:
      ${(codebaseContext || 'No local codebase context provided').slice(0, 8000)}
      
      PBI TO REVIEW:
      ${pbiContextBlock}
      `;

    // Run parallel agents
    const [secRes, archRes, qaRes, lawRes, feRes, beRes] = await Promise.all([
      generateText({
        model: modelObj,
        prompt: createAgentPrompt(
          'SECURITY EXPERT. Focus on security vulnerabilities, authentication flows, data privacy, and potential attack vectors.',
          customPrompts?.sec_agent,
        ),
      }),
      generateText({
        model: modelObj,
        prompt: createAgentPrompt(
          'SYSTEM ARCHITECT. Focus on database design, API structures, state management, file structure, scalability, and existing codebase patterns.',
          customPrompts?.arch_agent,
        ),
      }),
      generateText({
        model: modelObj,
        prompt: createAgentPrompt(
          'QA AUTOMATION ENGINEER. Focus on edge cases, testability, race conditions, and missing acceptance criteria.',
          customPrompts?.qa_agent,
        ),
      }),
      generateText({
        model: modelObj,
        prompt: createAgentPrompt(
          'LEGAL & COMPLIANCE. Focus on GDPR/CCPA implications, terms of service triggers, copyright, and accessibility standards.',
          customPrompts?.law_agent,
        ),
      }),
      generateText({
        model: modelObj,
        prompt: createAgentPrompt(
          'FRONTEND ENGINEER. Focus on UI components, state logic in the browser, CSS/styling, and client-side performance. VERY IMPORTANT: If this PBI is purely backend, explicitly state "Not applicable" and briefly explain why.',
          customPrompts?.fe_agent,
        ),
      }),
      generateText({
        model: modelObj,
        prompt: createAgentPrompt(
          'BACKEND ENGINEER. Focus on API endpoints, database queries, caching layers, business logic, and server performance. VERY IMPORTANT: If this PBI is purely frontend, explicitly state "Not applicable" and briefly explain why.',
          customPrompts?.be_agent,
        ),
      }),
    ]);

    evaluatedPBIs.push({
      ...pbi,
      agentReviews: [
        { agentName: 'Cipher', role: 'Security', feedback: secRes.text },
        { agentName: 'Atlas', role: 'Architect', feedback: archRes.text },
        { agentName: 'BugSmasher', role: 'QA', feedback: qaRes.text },
        { agentName: 'Justice', role: 'Compliance', feedback: lawRes.text },
        { agentName: 'Pixel', role: 'Frontend', feedback: feRes.text },
        { agentName: 'Node', role: 'Backend', feedback: beRes.text },
      ],
    });
  }

  return evaluatedPBIs;
}
