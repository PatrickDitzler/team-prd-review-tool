# 📋 PRD Review Tool

A web-based tool **and CLI** for product managers and engineering teams to **fetch PRDs from Confluence** (or upload them locally), **run AI-powered reviews**, **break down work into PBIs**, and **export directly to Azure DevOps**.

Both interfaces share the same core pipeline — use the web UI for team sessions, or the CLI from your terminal, IDE agents, or CI/CD workflows.

---

## ✨ Feature Overview

| Phase | Feature                                                   | Status  |
| ----- | --------------------------------------------------------- | ------- |
| 1     | Fetch PRD from Confluence (URL or Page ID)                | ✅ Done |
| 1     | Upload local PRD (PDF, DOCX, Markdown)                    | ✅ Done |
| 1     | Stage PRD as local markdown in `prds/`                    | ✅ Done |
| 2     | AI-powered review — generate QA, Eng, & Design questions  | ✅ Done |
| 2     | AI-powered work breakdown — decompose PRD into PBIs       | ✅ Done |
| 2     | Swarm Evaluation — 6-agent parallel AI review of each PBI | ✅ Done |
| 2     | Export PBIs to Azure DevOps as Feature + child work items | ✅ Done |
| 2     | Multi-provider LLM support via Vercel AI SDK              | ✅ Done |
| 2     | Custom agent prompt overrides per role                    | ✅ Done |
| 2     | Support for CLI tooling                                   | ✅ Done |

---

## Prerequisites

- **Node.js 20+**
- **A Confluence Cloud account** with a personal API token _(only required for Confluence fetch; upload mode works without it)_
- **An LLM API key** from any supported provider _(optional — a Mock/Demo mode is built in)_

---

## Basic Setup (Do this first!)

Before you can use the tool, you need to download the code and install the required pieces.

### 1. Download the code

Open your terminal (Command Prompt, PowerShell, or macOS Terminal) and run:

```bash
git clone https://github.com/patrickditzler/team-prd-review-tool.git
cd team-prd-review-tool
npm install
```

### 2. Configure credentials (Optional, for Confluence)

If you want to fetch documents directly from Atlassian Confluence, you need to set up your credentials. If you just want to upload local files (PDFs, Word docs), you can **skip this step**.

Run this command to create a local settings file:

```bash
cp .env.example .env.local
```

Then open `.env.local` and add your details:

```env
CONFLUENCE_BASE_URL=https://yourteam.atlassian.net
CONFLUENCE_USER_EMAIL=you@company.com
CONFLUENCE_API_TOKEN=your-api-token-here
```

_(You can get an API token from [Atlassian Security Settings](https://id.atlassian.com/manage-profile/security/api-tokens))_

---

## How do you want to use the tool?

You have three options for how to use this tool:

1. **The Web App:** A traditional website interface that runs in your browser. Great for visual learners and teams reviewing together.
2. **The CLI (Command Line):** A text-based interface that runs right in your terminal. Great for developers who prefer the keyboard.
3. **IDE AI Agents:** For developers using a tool like Cursor, Antigravity, or Copilot.

Choose your adventure below! 👇

---

## 🌐 Option 1: Running the Web App

### 1. Start the server

Run this command in your terminal:

```bash
npm run dev
```

### 2. Open your browser

Go to **[http://localhost:3000](http://localhost:3000)** in Chrome, Safari, etc.

### 3. Setup your AI

Click the ⚙️ (Settings) icon in the top right corner. Ensure your AI Provider is set up. You can use **"Mock / Demo Mode"** to see the intended use of the tool without any API keys, or plug in your OpenAI/Anthropic/Gemini keys.

### 4. Fetch or Upload a PRD

On the home page, you can:

- Paste a Confluence URL and click "Fetch"
- Drag and drop a PDF or Word Document
- Click "Try Fake Demo PRD" to see how it works instantly

### 5. Review & Breakdown

Follow the buttons through the tabs to:

1. Generate **Review Questions** for QA, Engineering, and Design.
2. Generate a **Work Breakdown** (a structured list of the features).
3. Run the **Swarm Evaluation** (watch 6 AI agents argue about your features!).
4. Export the resulting tasks directly to Azure DevOps.

---

## 💻 Option 2: Running the CLI (Command Line)

If you prefer the terminal, you can run the exact same steps without ever opening a web browser!

### 1. Configure the CLI

First, we need to tell the CLI which AI to use. Run:

```bash
npm run cli -- config
```

This launches a quick wizard. It will ask you which AI you want to use (Mock, OpenAI, Anthropic, etc.) and ask for your API key.

### 2. Run the full pipeline

The easiest way to use the CLI is one single command that walks you through everything step-by-step:

```bash
npm run cli -- run
```

_(If you want to try it out without real data, use `npm run cli -- run --demo`)_

### What the CLI will ask you:

When you run the pipeline, it will ask you simple questions:

1. **Source:** "Do you want to paste a Confluence link or a file path?"
2. **Review:** Opens an interactive menu where you can generate QA/Engineering questions, add notes, and even export the session to Markdown to collaborate with your team.
3. **Breakdown:** It shows you the feature breakdown and asks: "Do you approve this? Or do you want to edit it?"
4. **Evaluate:** It runs the 6 agents automatically.
5. **Export:** It asks: "Do you want to send these to Azure DevOps now?"

### (Optional) Run individual steps

If you only want to do one part of the process, you can run individual commands instead of the full `run` pipeline:

```bash
# Just load a file
npm run cli -- ingest ./docs/my-prd.md
# (This gives you a "Page ID", e.g., 1710000000_abc1234. Use that ID below!)

# Just generate questions
npm run cli -- review 1710000000_abc1234

# Just generate the breakdown
npm run cli -- breakdown 1710000000_abc1234

# Just run the agent swarm
npm run cli -- evaluate 1710000000_abc1234

# Just export to Azure
npm run cli -- export 1710000000_abc1234
```

_Note: The CLI remembers your place! It saves your progress in a temporary hidden file in your folder._

---

## 🤖 Option 3: Using IDE AI Agents (Cursor, Antigravity, etc.)

If you are using an AI agent built into your IDE, you can ask the agent to act as your assistant for the PRD review process. Because the CLI has a **non-interactive** execution mode and uses **Markdown files**, IDE agents are extremely effective.

### 1. Tell your agent to configure the tool

Just prompt your IDE agent:

> _"Please configure the PRD review tool for me. Run `npm run cli -- config` or create an `.env.local` file with my OpenAI key."_

### 2. Instruct the agent to run steps non-interactively

IDE agents struggle with interactive prompts (like those in the `run` wizard). Instead, ask the agent to use the individual CLI commands in `--non-interactive` mode.

For example, prompt your agent:

> _"I have a PRD at `./docs/my-prd.md`. Please ingest it using the CLI tool."_

Once it returns a Page ID (e.g., `12345`), prompt the agent again:

> _"Now generate the review questions for ID 12345 non-interactively. Run `npm run cli -- review 12345 --non-interactive`."_

### 3. Collaborate via Markdown

The `--non-interactive` review command generates a file called `prds/12345-review.md`.
Since it's just a file in your workspace, you can:

- Open the Markdown file natively in your IDE
- Type your answers
- Ask your agent to fill in the rest of the answers
- Ask your agent to brainstorm Custom Questions directly into the `.md` file

Then tell your agent:

> _"I've answered the questions in the markdown file. Please import them using the review command, then generate the breakdown and run the swarm evaluation."_

This creates a seamless flow where the AI agent does the heavy lifting via the CLI behind the scenes, and you just interact with standard Markdown files right inside your IDE!

---

## Development

| Command                    | Description                             |
| -------------------------- | --------------------------------------- |
| `npm run dev`              | Start Next.js dev server (webpack mode) |
| `npm run cli -- <command>` | Run CLI commands (see CLI section)      |
| `npm test`                 | Run unit tests with Vitest              |
| `npm run test:watch`       | Run tests in watch mode                 |
| `npm run lint`             | ESLint                                  |
| `npm run format`           | Prettier (auto-fix)                     |
| `npm run format:check`     | Prettier (check only)                   |
| `npm run build`            | Production build                        |
| `npm start`                | Start production server (after build)   |

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
├── cli/                                  # CLI interface (mirrors web workflow)
│   ├── index.ts                          # Entry point — registers all commands
│   ├── commands/
│   │   ├── ingest.ts                     # Ingest PRD (Confluence / file / demo)
│   │   ├── review.ts                     # Generate review questions interactively
│   │   ├── breakdown.ts                  # Generate & approve concept breakdown
│   │   ├── evaluate.ts                   # Run 6-agent swarm evaluation
│   │   ├── export.ts                     # Export PBIs to Azure DevOps
│   │   ├── run.ts                        # Full pipeline in one command
│   │   └── config.ts                     # Configuration wizard
│   └── utils/
│       └── display.ts                    # Terminal formatting helpers
├── lib/
│   ├── core/                             # Shared business logic (web + CLI)
│   │   ├── types.ts                      # Shared TypeScript interfaces
│   │   ├── ingest.ts                     # PRD ingestion logic
│   │   ├── review.ts                     # Question generation logic
│   │   ├── review-session.ts             # Interactive session export/import
│   │   ├── breakdown.ts                  # Breakdown generation logic
│   │   ├── evaluate.ts                   # Swarm evaluation logic
│   │   ├── export.ts                     # Azure DevOps export logic
│   │   ├── codebase-scanner.ts           # Local codebase context scanner
│   │   └── config.ts                     # Config file management
│   ├── confluence.ts                     # Confluence REST API + HTML→Markdown (Turndown)
│   └── llm-provider.ts                   # Multi-provider LLM factory (Vercel AI SDK)
├── __tests__/
│   ├── lib/confluence.test.ts            # Unit tests for Confluence URL parsing & MD conversion
│   └── setup.ts                          # Vitest + jsdom setup
├── prds/                                 # Staged PRD markdown files (gitignored)
├── .prd-review.example.json              # Example CLI config (copy to .prd-review.json)
├── .env.local                            # Local credentials (gitignored)
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── .prettierrc
```

---

## Environment Variables

| Variable                | Required                   | Description                                              |
| ----------------------- | -------------------------- | -------------------------------------------------------- |
| `CONFLUENCE_BASE_URL`   | Yes (for Confluence fetch) | Your Atlassian domain, e.g. `https://acme.atlassian.net` |
| `CONFLUENCE_USER_EMAIL` | Yes (for Confluence fetch) | The email associated with your Confluence account        |
| `CONFLUENCE_API_TOKEN`  | Yes (for Confluence fetch) | Personal API token from Atlassian                        |

> LLM API keys are **not** stored in `.env`. They are passed from the browser via the Settings page and forwarded server-side only during API calls.

---

## Roadmap & Changelog

- Check out the [ROADMAP.md](./ROADMAP.md) for planned future features and integrations.
- Check out the [CHANGELOG.md](./CHANGELOG.md) for notable project updates and versions.

---

## License

[MIT](./LICENSE)
