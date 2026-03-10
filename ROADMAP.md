# Product Roadmap

This document outlines the completed milestones and planned future features for the PRD Review Tool.

## Phase 1 (Completed)

- [x] Fetch PRD from Confluence using URL or numeric Page ID.
- [x] Upload local PRD files (PDF, DOCX, Markdown, TXT).
- [x] Stage PRDs as Markdown locally in the `prds/` directory.

## Phase 2 (Completed)

- [x] Evaluate PRDs to generate role-specific review questions (QA, Engineering, Design).
- [x] Perform high-level work breakdown into Product Backlog Items (PBIs).
- [x] Introduce 6-agent swarm evaluation with role-specific personas and codebase context tracking.
- [x] Add Azure DevOps export (linking Feature items to child PBI work items).
- [x] Integrate multi-provider LLM support (OpenAI, Anthropic, Gemini, OpenRouter, Local).
- [x] Build configurable agent persona overrides (`localStorage` and `.prd-review.json`).
- [x] Create a full-featured CLI Tool sharing core business logic with the web application.
- [x] Implement robust persistent session history for multi-day collaborative editing tracking (via markdown export/import).

## Phase 3 (Planned)

- [ ] Incorporate direct Jira integration for agile ticket generation and export.
- [ ] Add SAFe and semantic story-point estimation templates for PBI generation.
- [ ] Build a VS Code extension leveraging the shared core application architecture.
