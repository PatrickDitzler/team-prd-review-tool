# PRD Review Tool

A web-based tool for product managers to fetch PRDs from Confluence, stage them as local markdown files, and (soon) run AI-powered reviews.

Built with **Next.js 16**, **TypeScript**, **Chakra UI v3**, and the **Vercel AI SDK** for multi-provider LLM support.

---

## Prerequisites

- Node.js 20+
- A Confluence Cloud account with a personal API token

---

## Setup

**1. Clone and install**

```bash
git clone https://github.com/patrickditzler/team-prd-review-tool.git
cd team-prd-review-tool
npm install
```

**2. Configure credentials**

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

**3. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

1. Paste a Confluence page URL or numeric page ID into the input field
2. Click **Fetch PRD**
3. The page content is converted to markdown, displayed in the preview panel, and saved to `prds/<page-title>.md`

Both URL formats are supported:
```
# Modern URL
https://yourteam.atlassian.net/wiki/spaces/ENG/pages/98765/My-PRD

# Legacy URL
https://yourteam.atlassian.net/wiki/pages/viewpage.action?pageId=98765

# Plain ID
98765
```

---

## Development

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (auto-fix) |
| `npm run format:check` | Prettier (check only) |
| `npm run build` | Production build |

---

## Project Structure

```
├── app/
│   ├── api/confluence/fetch/route.ts   # Confluence fetch endpoint
│   ├── page.tsx                        # Main UI
│   ├── layout.tsx                      # Root layout
│   └── globals.css                     # Design system
├── lib/
│   └── confluence.ts                   # Confluence API + HTML→MD conversion
├── __tests__/
│   └── lib/confluence.test.ts          # Unit tests
└── prds/                               # Staged PRDs (gitignored)
```

---

## Roadmap

- [x] Phase 1 — Fetch PRD from Confluence and stage as markdown
- [ ] Phase 2 — LLM-powered PRD review (OpenAI, Anthropic, Gemini, and more)
- [ ] Phase 3 — Ask hard questions, break down work, create tickets
