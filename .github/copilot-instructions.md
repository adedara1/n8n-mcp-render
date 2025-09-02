# GitHub Copilot instructions for n8n‑MCP

Kurz, konkret und handlungsorientiert: diese Datei bringt AI-Copilots schnell in eine produktive Lage für dieses Repository.

## Zweck
- Helfen, n8n‑MCP-Code sicher zu verändern, lokal zu bauen, zu testen und die MCP-Server-Integration korrekt zu verwenden.

## Wichtige Grundregeln (unbedingt befolgen)
- Bearbeite niemals Produktions-Workflows direkt mit AI. Immer eine Kopie anlegen und in Dev testen (`data/` enthält die DB).
- Vor jedem Test BUILD ausführen: `npm run build` (TypeScript -> `dist/`) — viele CLI-Skripte nutzen `dist/`.
- Datenbank- oder Node-Änderungen erfordern oft: `npm run rebuild` gefolgt von `npm run validate`.

## Schnellbefehle (konkrete Beispiele)
- Build: `npm run build`
- Lokale Dev-Rebuild: `npm run dev` (build + rebuild + validate)
- MCP stdio starten: `npm start`
- MCP HTTP starten: `npm run start:http`
- Tests: `npm test` / `npm run test:unit` / `npm run test:integration`
- DB neu aufbauen: `npm run db:rebuild`

## Wo anfangen (Dateien, die schnell Kontext geben)
- `README.md` — Projektübersicht & Deploy‑Optionen (npx, Docker)
- `CLAUDE.md` — detaillierte Agent-Anweisungen; viele Muster hier wiederverwenden
- `package.json` — Liste aller npm scripts (verwende genau diese)
- `src/mcp/index.ts` und `src/mcp/server.ts` — MCP-Server entrypoints und Tool-Registrierung
- `src/loaders/*`, `src/parsers/*`, `src/services/*`, `src/database/*` — Pipeline: Loader → Parser → Mapper → DB → Services

## Projekt-spezifische Patterns & Konventionen
- Repository-Pattern für DB-Zugriffe: Änderungen am Schema immer über `database/`-Adapter und Migrationen.
- Service-Layer trennt Geschäftslogik (`services/`) von Datenzugriff (`database/`).
- Validation-Profiles: `minimal`, `runtime`, `ai-friendly`, `strict` — benutze passend zum Kontext (`services/config-validator*`).
- Diff-basierte Updates für bestehende Workflows: `n8n_update_partial_workflow()` spart Token und ist bevorzugt für inkrementelle Änderungen.

## Agent-Workflows (konkrete API-Calls / Tools)
- Discovery: `search_nodes({query})`, `list_nodes({category})` (schnellste Suche nach passenden Node-Typen)
- Config: `get_node_essentials(nodeType)` — benutze das zuerst (10–20 essentielle Felder)
- Pre-Validation: `validate_node_minimal(nodeType, config)` → `validate_node_operation(nodeType, config, profile)`
- Workflow-Validation: `validate_workflow(workflow)`, `validate_workflow_expressions(workflow)`
- Deployment (nur wenn N8N_API_URL/KEY konfiguriert): `n8n_create_workflow`, `n8n_update_partial_workflow`

## Umgebungsvariablen, die Agenten kennen sollten
- MCP_MODE (stdio|http) — beeinflusst Startmodus (`npm start` vs. `npm run start:http`)
- N8N_API_URL, N8N_API_KEY — nur setzen wenn Deployment/Management erwünscht
- DISABLE_CONSOLE_OUTPUT, LOG_LEVEL — nützlich für tests/CI

## Performance- & Test-Hinweise
- Verwende `get_node_essentials()` statt `get_node_info()` für schnellere Antworten.
- DB-Rebuilds dauern (mehrere Minuten) — in CI- oder Dev-Skripten berücksichtigen.
- Optionales `better-sqlite3` kann lokal installiert werden; Projekt fällt auf `sql.js` zurück.

## Beispiele aus dem Repo (Copy-Paste-ready)
```
# Build + dev flow
npm run build
npm run rebuild
npm run validate

# Run MCP in http mode (for VS Code integrations)
MCP_MODE=http npm run start:http
```

## Einschränkungen dieser Datei
- Dokumentiert nur entdeckbare Patterns und Befehle aus Repo-Dateien (README/CLAUDE/package.json/docs).
- Keine Annahmen über inoffizielle Workflows oder Secrets. Wenn etwas fehlt, bitte konkret nach Verzeichnis/Datei fragen.

---
Wenn diese Anleitung unklar oder unvollständig ist, nenne bitte die Bereiche (Build / Test / MCP intern / DB / Deployment), dann ergänze ich sie präzise.
