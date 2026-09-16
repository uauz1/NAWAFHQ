# NAWAF HQ V2

V2 is isolated from the legacy `hq_state` JSON document. Its source of truth is the normalized `hq_v2_*` schema in Supabase. The legacy production application and data are not modified by the V2 runtime.

## Runtime flow

`Command intake -> deterministic Arabic router -> employee profile -> capability resolver -> shared execution engine -> adapter -> evidence validator -> Supabase -> SSE UI -> secretary brief`

Employees are profiles and routing policies. They do not own separate execution engines.

## Safety boundaries

- All browser data access goes through the server. V2 uses a publishable Supabase key plus a server-only custom key checked by RLS; no service-role key is required or exposed.
- V2 tables have RLS enabled and access revoked from `anon` and `authenticated`.
- Mutating API routes require `HQ_V2_ACCESS_TOKEN`.
- Real-money trading is not implemented. The finance execution path is paper-only.
- Destructive or real-money wording creates an approval record instead of executing.
- A result cannot complete without persisted evidence.
- Temporary upstream errors use bounded exponential retries and release the employee.

## Free-tier background execution

The web process consumes durable queued tasks while awake. Supabase preserves queued and completed state across browser closure and Render sleep. A free Render service cannot guarantee 24/7 processing while asleep; work resumes after the service wakes.

## Verification

Run `npm run v2:check` for syntax, router, state-machine, adapter, paper-order, schema, accessibility, and responsive UI tests.
