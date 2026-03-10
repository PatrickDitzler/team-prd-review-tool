# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Core PRD Review Framework:** Comprehensive PRD review system including AI-powered analysis, customizable prompts, and codebase context integration.
- **Multi-Provider AI:** Support for multiple LLM providers via Vercel AI SDK (OpenAI, Anthropic, Gemini, OpenRouter, Local/LM Studio).
- **Swarm Evaluation:** Concurrent evaluation of Product Backlog Items using a 6-agent swarm specifically tuned to roles (Security, Architecture, QA, Compliance, Frontend, Backend).
- **CLI Interface:** A full-featured Command Line Interface (`prd-review`) mirroring the exact workflows of the web application.
- **Enhanced CLI Review Session:** Menu-driven interactive review flow in the CLI, including custom question additions, discussion notes, and markdown export/import for team collaboration.
- **Ingestion Pipeline:** Extraction and ingestion from Confluence (URLs or numeric Page IDs) and local documents (PDF, DOCX, Markdown, TXT).
- **Exporting:** Direct export of evaluated PBIs to Azure DevOps as linked Feature and child work items.
- **Project Context:** Added `AGENTS.md` to guide AI-assisted coding and project context.
- **Theming:** Full light/dark mode support using Chakra UI v3 and custom properties.

### Changed

- **Architecture Refactor:** Abstracted core business logic from Next.js API Routes into a shared library (`lib/core/`) to facilitate code reuse across the Web UI and the new CLI tool.
- **Documentation:** Updated base repository `README.md` to include comprehensive CLI instructions, environment variables, system architecture details, and usage patterns.
