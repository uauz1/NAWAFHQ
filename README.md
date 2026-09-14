# Nawaf HQ

Operating interface for Nawaf's AI workforce. The current free-to-host foundation uses browser persistence and a shared company state. It starts clean: no seeded progress, reports, or activity are presented as completed work.

## Current capabilities

- Interactive isometric office whose employee states follow real task state
- CEO command intake and company/project/department/direct discussion rooms
- Editable AI employees with one shared source of truth
- Evidence-linked tasks, audit trail, stored artifacts, reports, reviews, and proposals
- A read-only `$0` GitHub public adapter that performs a real repository inspection
- Progress calculated from completed evidence steps, never timers
- Arabic RTL desktop and mobile layout

## Reality boundary

- `REAL_CONNECTED_ACTION`: an adapter actually reached its source.
- `INTERNAL_AI_WORK`: reserved for a connected model; no model is currently connected.
- `WAITING_FOR_NAWAF`: sensitive or external actions cannot proceed without approval.

The GitHub adapter lives in `dist/adapters/`. Model, file, analytics, and development-environment adapters can be added there without coupling them to UI components. The AI-model integration is deliberately disabled until Nawaf authorizes a suitable free connection.

Run `npm test` for source, asset, department, workflow, and safety-rule smoke checks.
