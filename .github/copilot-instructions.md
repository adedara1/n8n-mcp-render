# GitHub Copilot instructions for n8n‑MCP

Short, concise, and action-oriented: this file quickly gets AI copilots up and running for this repository.

## Purpose
- Help to safely modify n8n‑MCP code, build it locally, test it, and use the MCP server integration correctly.

## Important basic rules (must be followed)
- Never edit production workflows directly with AI. Always make a copy and test it in Dev (`data/` contains the DB).
- Run BUILD before each test: `npm run build` (TypeScript -> `dist/`) — many CLI scripts use `dist/`.
- Database or node changes often require: `npm run rebuild` followed by `npm run validate`.

## Quick commands (specific examples)
- Build: `npm run build`
- Local dev rebuild: `npm run dev` (build + rebuild + validate)
- Start MCP stdio: `npm start`
- Start MCP HTTP: `npm run start:http`
- Tests: `npm test` / `npm run test:unit` / `npm run test:integration`
- Rebuild DB: `npm run db:rebuild`

## Where to start (files that quickly provide context)
- `README.md` — Project overview & deployment options (npx, Docker)
- `CLAUDE.md` — Detailed agent instructions; reuse many patterns here
- `package.json` — List of all npm scripts (use exactly these)
- `src/mcp/index.ts` and `src/mcp/server.ts` — MCP server entry points and tool registration
- `src/loaders/*`, `src/parsers/*`, `src/services/*`, `src/database/*` — Pipeline: Loader → Parser → Mapper → DB → Services

## Project-specific patterns & conventions
- Repository pattern for DB access: Always make changes to the schema via `database/` adapters and migrations.
- Service layer separates business logic (`services/`) from data access (`database/`).
- Validation profiles: `minimal`, `runtime`, `ai-friendly`, `strict` — use as appropriate for the context (`services/config-validator*`).
- Diff-based updates for existing workflows: `n8n_update_partial_workflow()` saves tokens and is preferred for incremental changes.

## Agent workflows (specific API calls / tools)
- Discovery: `search_nodes({query})`, `list_nodes({category})` (fastest search for matching node types)
- Config: `get_node_essentials(nodeType)` — use this first (10–20 essential fields)
- Pre-validation: `validate_node_minimal(nodeType, config)` → `validate_node_operation(nodeType, config, profile)`
- Workflow validation: `validate_workflow(workflow)`, `validate_workflow_expressions(workflow)`
- Deployment (only if N8N_API_URL/KEY is configured): `n8n_create_workflow`, `n8n_update_partial_workflow`

## Environment variables that agents should know
- MCP_MODE (stdio|http) — affects start mode (`npm start` vs. `npm run start:http`)
- N8N_API_URL, N8N_API_KEY — only set if deployment/management is desired
- DISABLE_CONSOLE_OUTPUT, LOG_LEVEL — useful for tests/CI

## Performance & testing notes
- Use `get_node_essentials()` instead of `get_node_info()` for faster responses.
- DB rebuilds take time (several minutes) — take this into account in CI or Dev scripts.
- Optional `better-sqlite3` can be installed locally; project falls back to `sql.js`.

## Examples from the repo (copy-paste-ready)
```
# Build + dev flow
npm run build
npm run rebuild
npm run validate

# Run MCP in http mode (for VS Code integrations)
MCP_MODE=http npm run start:http
```

## Limitations of this file
- Only documents discoverable patterns and commands from repo files (README/CLAUDE/package.json/docs).
- No assumptions about unofficial workflows or secrets. If something is missing, please ask specifically for the directory/file.

---
If these instructions are unclear or incomplete, please specify the areas (build / test / MCP internal / DB / deployment) and I will add the necessary details.

Translated with DeepL.com (free version)
