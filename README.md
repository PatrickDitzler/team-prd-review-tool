# 📋 PRD Review Tool

A web-based tool for product managers and engineering teams to **fetch PRDs from Confluence** (or upload them locally), **run AI-powered reviews**, **break down work into PBIs**, and **export directly to Azure DevOps**.

Built with **Next.js 16**, **TypeScript**, **Chakra UI v3**, and the **Vercel AI SDK** for multi-provider LLM support (OpenAI, Anthropic, Google Gemini, OpenRouter, and local models).

---

## ✨ Feature Overview

| Phase | Feature | Status |
|---|---|---|
| 1 | Fetch PRD from Confluence (URL or Page ID) | ✅ Done |
| 1 | Upload local PRD (PDF, DOCX, Markdown) | ✅ Done |
| 1 | Stage PRD as local markdown in `prds/` | ✅ Done |
| 2 | AI-powered review — generate QA, Eng, & Design questions | ✅ Done |
| 2 | AI-powered work breakdown — decompose PRD into PBIs | ✅ Done |
| 2 | Swarm Evaluation — 6-agent parallel AI review of each PBI | ✅ Done |
| 2 | Export PBIs to Azure DevOps as Feature + child work items | ✅ Done |
| 2 | Multi-provider LLM support via Vercel AI SDK | ✅ Done |
| 2 | Custom agent prompt overrides per role | ✅ Done |
| 2 | Support for CLI tooling | Planned |

---

## Prerequisites

- **Node.js 20+**
- **A Confluence Cloud account** with a personal API token *(only required for Confluence fetch; upload mode works without it)*
- **An LLM API key** from any supported provider *(optional — a Mock/Demo mode is built in)*

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/patrickditzler/team-prd-review-tool.git
cd team-prd-review-tool
npm install
```

### 2. Configure credentials

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Confluence details:

```env
CONFLUENCE_BASE_URL=https://yourteam.atlassian.net
CONFLUENCE_USER_EMAIL=you@company.com
CONFLUENCE_API_TOKEN=your-api-token-here
```

> Generate an API token at [id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

> **Note:** The `.env.local` file is gitignored. Never commit your credentials.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### Step 1 — Ingest a PRD

**Option A: Fetch from Confluence**

Paste a Confluence page URL or numeric page ID into the input field and click **Fetch PRD**.

Supported URL formats:
```
# Modern URL
https://yourteam.atlassian.net/wiki/spaces/ENG/pages/98765/My-PRD

# Legacy URL
https://yourteam.atlassian.net/wiki/pages/viewpage.action?pageId=98765

# Plain numeric ID
98765
```

**Option B: Upload a local file**

Drag and drop (or click to browse) a `PDF`, `DOCX`, `.md`, or `.txt` file directly onto the upload zone.

Once ingested, the PRD is:
- Converted to Markdown
- Staged to `prds/<page-title-or-id>.md` on the server
- Shown in a preview panel

> Click **"Try Fake Demo PRD"** to load a built-in sample without any Confluence setup.

---

### Step 2 — Review Session (`/review/:pageId`)

After ingesting a PRD, click **"Start PRD Review →"** to open the review session. This page has three tabs:

#### Tab 1: Review Questions
The AI generates structured questions from the PRD for three disciplines:
- **QA** — edge cases, test scenarios
- **Engineering** — architecture, implementation concerns
- **Design** — UX, accessibility, visual consistency

Each set of questions can be regenerated independently.

#### Tab 2: Work Breakdown
The AI decomposes the PRD into a list of **Product Backlog Items (PBIs)**. Each PBI includes:
- A summary description
- A linked breakdown of functional concepts

#### Tab 3: Swarm Evaluation
Provide the absolute path to your local codebase. The tool will:
1. Scan the codebase for structural context
2. Send that context + the PBI breakdown to 6 specialized AI agents **in parallel**:
   - **Cipher** (Security) — vulnerabilities, auth, data privacy
   - **Atlas** (Architect) — DB design, API structure, scalability
   - **BugSmasher** (QA) — edge cases, testability, race conditions
   - **Justice** (Compliance) — GDPR/CCPA, accessibility, TOS
   - **Pixel** (Frontend) — UI components, state, client-side performance
   - **Node** (Backend) — API endpoints, queries, caching, server performance

Each PBI card shows the description, functional requirements, Gherkin acceptance criteria, and the consensus from all 6 agents. PBIs can be edited inline before export.

#### Export to Azure DevOps
After swarm evaluation, click **"Export to Azure DevOps"** and provide:
- **Organization name** (e.g. `contoso`)
- **Project name** (e.g. `MyStoreApp`)
- **Personal Access Token (PAT)**

The tool creates a parent **Feature** work item (linked to the PRD) and child **Product Backlog Item** work items for each generated PBI.

---

### Step 3 — AI Provider Settings (`/settings`)

Click the ⚙️ icon in the top-right to configure your LLM provider.

| Provider | Notes |
|---|---|
| **Mock / Demo** | No API key needed. Returns static example responses. |
| **OpenAI** | Requires `sk-...` key. Default model: `gpt-4o`. |
| **Anthropic** | Requires API key. Default model: `claude-3-7-sonnet-latest`. |
| **Google Gemini** | Requires API key. Default model: `gemini-2.5-flash`. |
| **OpenRouter** | Aggregator — supports any model via OpenAI-compatible API. |
| **Local (LM Studio / Ollama)** | No key needed. Default base URL: `http://localhost:1234/v1`. |

Settings and API keys are stored **only in your browser's `localStorage`** — they are never sent to the server except as part of the LLM request payload.

#### Custom Agent Prompts

The Settings page also lets you override the default system prompts for each agent role and review type (max 500 chars per field). Leave blank to use the built-in factory defaults.

---

## Development

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (webpack mode) |
| `npm test` | Run unit tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (auto-fix) |
| `npm run format:check` | Prettier (check only) |
| `npm run build` | Production build |
| `npm start` | Start production server (after build) |

---

## Project Structure

```
team-prd-review-tool/
├── app/
│   ├── api/
│   │   ├── confluence/fetch/route.ts     # Fetch & convert Confluence page → Markdown
│   │   ├── upload/route.ts               # Accept PDF/DOCX/MD uploads → Markdown
│   │   ├── review/
│   │   │   ├── questions/route.ts        # Generate QA / Eng / Design questions
│   │   │   └── breakdown/route.ts        # Decompose PRD into PBI concepts
│   │   ├── evaluate-pbi/route.ts         # 6-agent swarm evaluation (parallel AI calls)
│   │   ├── codebase/route.ts             # Scan local codebase → structured context string
│   │   └── azure/export/route.ts         # Export Feature + PBIs to Azure DevOps
│   ├── review/
│   │   └── [pageId]/
│   │       ├── page.tsx                  # Review session server component
│   │       └── ReviewPanel.tsx           # Tabs: Questions / Breakdown / Swarm
│   ├── settings/
│   │   └── page.tsx                      # AI provider + custom prompt settings
│   ├── page.tsx                          # Home — Confluence fetch + file upload
│   ├── layout.tsx                        # Root layout
│   ├── providers.tsx                     # Chakra UI provider wrapper
│   └── globals.css                       # Full design system (CSS custom properties)
├── components/
│   ├── SwarmEvaluator.tsx                # Swarm tab UI + Azure export modal
│   ├── PromptSettings.tsx                # Custom persona/prompt form component
│   ├── ThemeToggle.tsx                   # Light/dark mode toggle
│   └── ThemeProvider.tsx                 # CSS class-based theme context
├── lib/
│   ├── confluence.ts                     # Confluence REST API + HTML→Markdown (Turndown)
│   └── llm-provider.ts                   # Multi-provider LLM factory (Vercel AI SDK)
├── __tests__/
│   ├── lib/confluence.test.ts            # Unit tests for Confluence URL parsing & MD conversion
│   └── setup.ts                          # Vitest + jsdom setup
├── prds/                                 # Staged PRD markdown files (gitignored)
├── .env.local                            # Local credentials (gitignored)
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── .prettierrc
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CONFLUENCE_BASE_URL` | Yes (for Confluence fetch) | Your Atlassian domain, e.g. `https://acme.atlassian.net` |
| `CONFLUENCE_USER_EMAIL` | Yes (for Confluence fetch) | The email associated with your Confluence account |
| `CONFLUENCE_API_TOKEN` | Yes (for Confluence fetch) | Personal API token from Atlassian |

> LLM API keys are **not** stored in `.env`. They are passed from the browser via the Settings page and forwarded server-side only during API calls.

---

## Roadmap

- [x] **Phase 1** — Fetch PRD from Confluence and stage as Markdown
- [x] **Phase 1** — Upload local PRD files (PDF, DOCX, MD)
- [x] **Phase 2** — LLM-powered review questions (QA, Engineering, Design)
- [x] **Phase 2** — Work breakdown into PBIs
- [x] **Phase 2** — 6-agent swarm evaluation with codebase context
- [x] **Phase 2** — Azure DevOps export (Feature + child PBI work items)
- [x] **Phase 2** — Multi-provider LLM support (OpenAI, Anthropic, Gemini, OpenRouter, Local)
- [x] **Phase 2** — Custom agent persona overrides
- [ ] **Phase 3** — Jira integration for ticket export
- [ ] **Phase 3** — SAFe / story-point estimation templates
- [ ] **Phase 3** — Persistent session history

---

## License

[MIT](./LICENSE)
