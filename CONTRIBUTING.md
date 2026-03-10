# Contributing to PRD Review Tool

First off, thanks for taking the time to contribute! This tool is designed to be easily extensible, whether you are coding manually or using an AI coding assistant (like Cursor, Copilot, Claude Code, or Antigravity).

## Codebase Context for AI Agents

We maintain a comprehensive guide for automated development inside **`AGENTS.md`**. 

If you are using an AI coding assistant, please instruct it to **read `AGENTS.md` first**. It contains:
- The shared core architecture (`lib/core/` vs API/CLI wrappers)
- Specific Next.js constraints (`--webpack` flag)
- Step-by-step playbooks for adding new API routes, CLI commands, and Swarm agents.
- Rules on CSS custom properties and client-side storage.

## Development Setup

1. **Clone & Install:**
   ```bash
   git clone https://github.com/patrickditzler/team-prd-review-tool.git
   cd team-prd-review-tool
   npm install
   ```
2. **Setup Environment:** (Only required if testing Confluence fetch)
   ```bash
   cp .env.example .env.local
   # Fill in Confluence credentials in .env.local
   ```
3. **Run the Web App:** `npm run dev`
4. **Run the CLI:** `npm run cli -- run`
5. **Run Tests:** `npm test`

## Contribution Guidelines

- **Keep the Core Shared:** Any business logic must live in `lib/core/`. Do not put logic directly into Next.js API routes (`app/api/`) or CLI commands (`cli/commands/`).
- **Pass the CI Checks:** Before submitting a Pull Request, ensure:
  - `npm run lint` passes
  - `npm run format` has been run
  - `npm test` passes
- **Mock Mode:** When adding new LLM features, ensure they respect Provider "Mock Mode" so features can be tested locally without API keys.

Happy building!
