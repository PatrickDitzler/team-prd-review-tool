# AGENTS.md — Automated Development Guide

This file provides context and conventions for AI coding agents (e.g. Gemini, Copilot, Claude, Cursor) working on the **PRD Review Tool** codebase. Read this file before making any changes.

---

## Project Overview

**PRD Review Tool** is a Next.js 16 web app **and CLI tool** that helps product managers:

1. **Ingest** a PRD from Confluence (via URL/page ID) or from a local file upload (PDF, DOCX, Markdown)
2. **Stage** the PRD as a local Markdown file in `prds/`
3. **Review** the PRD using an AI that generates QA, engineering, and design questions
4. **Break down** the PRD into Product Backlog Items (PBIs)
5. **Evaluate** each PBI using a swarm of 6 specialized AI agents running in parallel
6. **Export** the PBIs as Feature + child work items to Azure DevOps

Both the **web UI** and the **CLI** share a common core library (`lib/core/`) containing all business logic.

---

## Tech Stack

| Layer              | Technology                                                            |
| ------------------ | --------------------------------------------------------------------- |
| Framework          | Next.js 16 (App Router, `--webpack` flag)                             |
| Language           | TypeScript 5                                                          |
| UI Components      | Chakra UI v3 + Lucide React icons                                     |
| Styling            | Vanilla CSS with custom properties (`app/globals.css`)                |
| AI SDK             | Vercel AI SDK (`ai` package)                                          |
| LLM Providers      | OpenAI, Anthropic, Google Gemini, OpenRouter, Local (via `@ai-sdk/*`) |
| Schema Validation  | Zod                                                                   |
| MD Conversion      | Turndown (HTML → Markdown)                                            |
| File Parsing       | `mammoth` (DOCX), `pdf-parse` (PDF)                                   |
| CLI                | Commander + @inquirer/prompts + chalk + ora                           |
| Testing            | Vitest + jsdom + @testing-library/react                               |
| Linting/Formatting | ESLint (Next.js config), Prettier                                     |

---

## Repository Structure

```
app/
  api/
    confluence/fetch/route.ts   # POST — fetch Confluence page → staged Markdown
    upload/route.ts             # POST — accept file upload → staged Markdown
    review/
      questions/route.ts        # POST — generate QA/Eng/Design questions via LLM
      breakdown/route.ts        # POST — decompose PRD into PBI concepts via LLM
    evaluate-pbi/route.ts       # POST — 6-agent swarm evaluation (parallel generateText)
    codebase/route.ts           # POST — scan a local absolute path → context string
    azure/export/route.ts       # POST — create Azure DevOps Feature + PBI work items
  review/[pageId]/
    page.tsx                    # Server component — reads `prds/<pageId>.md` from disk
    ReviewPanel.tsx             # Client component — tabbed review UI
  settings/page.tsx             # Client component — LLM provider + custom prompt config
  page.tsx                      # Home — Confluence fetch + file upload entry point
  layout.tsx                    # Root layout with Chakra + Theme providers
  globals.css                   # Design system (CSS custom properties, all utility classes)
components/
  SwarmEvaluator.tsx            # Swarm tab UI + Azure DevOps export modal
  PromptSettings.tsx            # Custom prompt form (QA/Eng/Design/Swarm agents)
  ThemeToggle.tsx               # Light/dark mode toggle button
  ThemeProvider.tsx             # Provides theme context via CSS class on <html>
lib/
  core/
    types.ts                    # Shared TypeScript interfaces (LLMSettings, EnhancedPBI, etc.)
    ingest.ts                   # PRD ingestion (Confluence, file, demo) — used by web + CLI
    review.ts                   # Question generation — used by web + CLI
    review-session.ts           # Markdown export/import for collaborative team reviews
    breakdown.ts                # Breakdown generation (streaming + non-streaming)
    evaluate.ts                 # 6-agent swarm evaluation — used by web + CLI
    export.ts                   # Azure DevOps export — used by web + CLI
    codebase-scanner.ts         # Local codebase context scanner
    config.ts                   # .prd-review.json config management
  confluence.ts                 # extractPageId(), fetchConfluencePage(), htmlToMarkdown()
  llm-provider.ts               # getLLMProvider(settings) — returns a LanguageModel
cli/
  index.ts                      # CLI entry point — registers all commands via Commander
  commands/
    ingest.ts                   # `prd-review ingest` — Confluence / file / demo
    review.ts                   # `prd-review review` — generate & answer questions
    breakdown.ts                # `prd-review breakdown` — generate & approve
    evaluate.ts                 # `prd-review evaluate` — run 6-agent swarm
    export.ts                   # `prd-review export` — Azure DevOps
    run.ts                      # `prd-review run` — full interactive pipeline
    config.ts                   # `prd-review config` — setup wizard
  utils/
    display.ts                  # Terminal formatting (headers, tables, colors)
__tests__/
  lib/confluence.test.ts        # Unit tests for URL parsing + HTML→MD conversion
  setup.ts                      # jsdom test setup
prds/                           # Staged PRD markdown (gitignored, created at runtime)
```

---

## Conventions & Patterns

### API Route Pattern

All API routes follow this exact pattern:

```typescript
// app/api/<name>/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { fieldA, fieldB } = await req.json();

    if (!fieldA) {
      return NextResponse.json({ error: 'Missing fieldA' }, { status: 400 });
    }

    // ... business logic ...

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Context message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
```

- **Always** use `try/catch` with a catch-all error response.
- **Always** validate required fields and return `400` with an `error` string.
- **Never** return sensitive information (env vars, tokens) in error responses.
- **API routes are thin wrappers** — all business logic lives in `lib/core/`. Call the shared functions, don't duplicate.

### Shared Core Pattern

All business logic is in `lib/core/`. Both API routes and CLI commands import from here. When adding new functionality:

1. Add the core logic as a function in `lib/core/<module>.ts`
2. Create the API route in `app/api/` that calls the core function
3. (Optional) Add a CLI command in `cli/commands/` that calls the same core function

```typescript
// lib/core/review.ts — the shared business logic
export async function generateReviewQuestions(markdown, type, settings, customPrompts) { ... }

// app/api/review/questions/route.ts — thin HTTP wrapper
import { generateReviewQuestions } from '@/lib/core/review';
export async function POST(req) {
  const { markdown, type, settings } = await req.json();
  const questions = await generateReviewQuestions(markdown, type, settings);
  return NextResponse.json({ questions });
}

// cli/commands/review.ts — thin CLI wrapper
import { generateReviewQuestions } from '../../lib/core/review';
const questions = await generateReviewQuestions(markdown, type, settings);
printQuestions(questions, type);
```

### LLM Calls

Use the `getLLMProvider` factory from `lib/llm-provider.ts`. Never instantiate AI SDK providers directly in route files.

```typescript
import { getLLMProvider, LLMSettings } from '@/lib/llm-provider';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

const model = getLLMProvider(settings); // settings comes from the request body

// For free-form text:
const { text } = await generateText({ model, prompt: '...' });

// For structured output:
const { object } = await generateObject({
  model,
  schema: z.object({ ... }),
  prompt: '...',
});
```

**Always handle `mock` provider mode** before calling `getLLMProvider`. Check `settings.provider === 'mock'` and return a hardcoded example response to allow UI testing without any API key.

### Swarm Evaluation Pattern

The evaluate-pbi route runs **6 agent calls in parallel** using `Promise.all`. The logic lives in `lib/core/evaluate.ts`. When adding a new agent:

1. Add a new `generateText` call to the `Promise.all` array in `lib/core/evaluate.ts`
2. Add the agent's named result to the `agentReviews` array
3. Add the corresponding icon and color mapping in `components/SwarmEvaluator.tsx`
4. Add a custom prompt field in `components/PromptSettings.tsx` and `DEFAULT_PROMPTS`
5. Update `cli/utils/display.ts` `printPBIs()` with the new role color

### Staging PRD Files

PRDs are always written to `prds/<identifier>.md` relative to `process.cwd()` (the project root). The `prds/` directory is **gitignored**. Routes that stage files must create the directory first:

```typescript
import { promises as fs } from 'fs';
import path from 'path';

const prdsDir = path.join(process.cwd(), 'prds');
await fs.mkdir(prdsDir, { recursive: true });
const filePath = path.join(prdsDir, `${safeId}.md`);
await fs.writeFile(filePath, markdown, 'utf-8');
```

Never accept user-supplied filenames without sanitizing them (`replace(/[^a-zA-Z0-9_-]/g, '_')`).

### Client-Side State & Settings

LLM settings and custom prompts are stored in `localStorage`, **not** in cookies or server state. Client components read them with:

```typescript
const settingsRaw = localStorage.getItem('llm_settings');
const settings = settingsRaw ? JSON.parse(settingsRaw) : null;
```

Do not add server-side session storage for these — keeping them client-side is intentional for privacy.

### CSS Design System

All styling lives in `app/globals.css` via CSS custom properties. **Do not add inline styles for colors, spacing, or typography** that aren't already defined as custom properties. Use the existing variables:

```css
var(--color-bg)              /* Page background */
var(--color-surface)         /* Card/panel background */
var(--color-surface-sunken)  /* Inset/sunken surface */
var(--color-primary)         /* Brand accent */
var(--color-text)            /* Primary text */
var(--color-text-muted)      /* Secondary text */
var(--color-border)          /* Default border */
var(--color-error)           /* Error/destructive */
var(--color-success)         /* Success */
var(--color-warning)         /* Warning */
var(--radius-sm / md / lg)   /* Border radii */
```

Themed dark/light switching is done by toggling a `dark` CSS class on `<html>`.

---

## Testing

- **Test runner:** Vitest with jsdom environment
- **Test location:** `__tests__/lib/` (mirror the `lib/` structure)
- **Test file naming:** `<module>.test.ts` or `<component>.test.tsx`
- **Run tests:** `npm test` (single run) or `npm run test:watch`

When adding a new `lib/` utility, add a corresponding test file in `__tests__/lib/`. Focus tests on:

- Input parsing (e.g. URL → page ID extraction)
- Edge cases and error handling
- Pure function behavior (not HTTP calls — mock those)

Example:

```typescript
import { describe, it, expect } from 'vitest';
import { extractPageId } from '@/lib/confluence';

describe('extractPageId', () => {
  it('parses a modern Confluence URL', () => {
    expect(extractPageId('https://team.atlassian.net/wiki/spaces/ENG/pages/12345/Title')).toBe(
      '12345',
    );
  });
});
```

---

## Environment Variables

| Variable                | Required         | Description                                         |
| ----------------------- | ---------------- | --------------------------------------------------- |
| `CONFLUENCE_BASE_URL`   | Yes (Confluence) | Atlassian domain, e.g. `https://acme.atlassian.net` |
| `CONFLUENCE_USER_EMAIL` | Yes (Confluence) | Atlassian account email                             |
| `CONFLUENCE_API_TOKEN`  | Yes (Confluence) | Atlassian personal API token                        |

Never add LLM API keys to `.env`. They are passed from the client and forwarded server-side only during AI SDK calls.

Copy `.env.example` → `.env.local` to get started. `.env.local` is gitignored.

---

## Common Tasks & Playbooks

### Adding a new API route

1. Create `app/api/<name>/route.ts`
2. Follow the route pattern above (POST handler, try/catch, field validation)
3. If the route calls an LLM, accept `settings: LLMSettings` in the request body and implement mock mode
4. Update `README.md` project structure table with the new route

### Adding a new Swarm agent role

1. In `app/api/evaluate-pbi/route.ts`:
   - Add a new `generateText` call in the `Promise.all` array
   - Add the result to `agentReviews` on each PBI push
2. In `components/SwarmEvaluator.tsx`:
   - Import the relevant Lucide icon
   - Add the icon/color mapping in the agent card render block
   - Add the agent to the loading animation icon row
3. In `components/PromptSettings.tsx`:
   - Add a new key to `DEFAULT_PROMPTS`
   - Add a `renderPromptInput(...)` call in the Swarm agents section

### Adding a new LLM provider

1. Install the corresponding `@ai-sdk/<provider>` package
2. In `lib/llm-provider.ts`, add a new `case` in the `getLLMProvider` switch statement
3. In `app/settings/page.tsx`, add a new `<option>` to the provider `<select>`

### Adding a new file upload format

1. In `lib/core/ingest.ts`, add a new branch for the file type in `ingestFromFile()` and `ingestFromBuffer()`
2. Install any required parsing library and add it to `package.json` dependencies
3. Update the `accept` attribute on the file input in `app/page.tsx`
4. Update the validation regex in `handleFileUpload` in `app/page.tsx`

### Adding a new CLI command

1. Create `cli/commands/<name>.ts` exporting a `registerXxxCommand(program: Command)` function
2. Import and call the shared core function from `lib/core/`
3. Use `@inquirer/prompts` for interactive input and `ora` for spinners
4. Register the command in `cli/index.ts`
5. Update `README.md` CLI commands table

---

## Key Constraints

- **`--webpack` flag is required.** Both `npm run dev` and `npm run build` use `next dev --webpack` / `next build --webpack`. Do not remove this flag.
- **`maxDuration = 300`** is set on the evaluate-pbi route because the 6-agent parallel swarm can take significant time. If adding a new long-running route, set this export accordingly.
- **`prds/` is gitignored.** Never treat PRD files as persistent — they are ephemeral staging artifacts.
- **No server-side session.** All user settings (LLM provider, custom prompts) live in browser `localStorage` (web) or `.prd-review.json` (CLI) only.
- **Confluence credentials are server-side only** (via `process.env`). They must never be sent to the client.
- **Azure DevOps PAT is client-supplied.** It is passed in the request body to `api/azure/export` and is never stored server-side.
- **Business logic lives in `lib/core/`.** API routes and CLI commands are thin wrappers. Never duplicate logic.
- **`.prd-review.json` is gitignored.** It may contain API keys. Use `.prd-review.example.json` as a template.

---

## Before Submitting a Change

- [ ] `npm run lint` passes with no errors
- [ ] `npm run format:check` passes (or run `npm run format` to auto-fix)
- [ ] `npm test` passes with no failures
- [ ] New API routes include mock mode support
- [ ] New utilities have corresponding unit tests in `__tests__/`
- [ ] No secrets, API keys, or credentials are hardcoded anywhere
- [ ] `README.md` project structure section is updated if new files were added
