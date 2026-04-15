# Copilot instructions for pm-ai

## Build, test, and lint commands

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

- There is currently no automated test setup in this repo (`package.json` has no `test` script and there are no `*.test.*` / `*.spec.*` files).
- Single-test command: not applicable until a test runner is added.

## High-level architecture

- This is a Next.js App Router app with a single UI-heavy client entrypoint and one API route.
- `app/page.tsx` contains most of the product logic: prompt definitions, state machine, analysis/spec pipeline, drag-and-drop ranking, markdown copy, and PDF print export.
- `app/api/analyze/route.ts` calls Anthropic Messages API server-side and reads `ANTHROPIC_API_KEY` from environment variables.
- The analyze route defaults to model `claude-sonnet-4-6` and can be overridden with `ANTHROPIC_MODEL`.
- Main flow:
  1. Feedback text is sent to `/api/analyze` with `SYSTEM_PROMPT_ANALYZE`, returning `Cluster[]`.
  2. Clusters are sorted by `priority_score` and can be reordered manually via `@dnd-kit`.
  3. Clicking a cluster triggers spec generation using either `SYSTEM_PROMPT_SPEC_SOFTWARE` or `SYSTEM_PROMPT_SPEC_OTHER` depending on `productMode`.
- Analysis history is browser-only (`localStorage` key: `pm-ai-history`) and capped at 10 entries.
- `app/layout.tsx` applies global fonts/CSS and includes Vercel Analytics.

## Key conventions in this codebase

- Keep the API key server-side. Client code should always call `/api/analyze`; never call Anthropic directly from the browser.
- AI responses are expected to be strict JSON. `callClaude` strips markdown code fences and parses JSON; then `toArray`/`normalizeTask` normalize shape drift from model outputs.
- `productMode` (`"software"` vs `"other"`) is a core branch and must stay aligned across prompts, spec typing, rendering, markdown export, and PDF export.
- UI progression is controlled by `stage` (`"idle" | "analyzing" | "speccing" | "done"`), which drives skeleton/loading and result panels.
- Styling is intentionally centralized inside `app/page.tsx` (large inline `<style>` block + inline style props), not in separate component style modules.
- Local setup requires `.env.local` in project root with `ANTHROPIC_API_KEY=...`.
