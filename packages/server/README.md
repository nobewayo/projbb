# Server Package (Planned)

This package hosts the Node.js (TypeScript) API/WebSocket authority for Bitby. The current skeleton wires up Fastify with:

- `/healthz` and `/readyz` endpoints aligned with the Master Spec observability guardrails (§17)
- a WebSocket endpoint at `/ws` that enforces the `bitby.v1` subprotocol, caps payloads at 64 KB, and gracefully closes with `1012` until realtime handlers land (§1)
- readiness tracking so orchestrators can mark the instance unavailable before shutdown

## Scripts

```bash
pnpm --filter @bitby/server dev      # Fastify dev server with tsx watcher
pnpm --filter @bitby/server build    # Emit compiled JS + type declarations to dist/
pnpm --filter @bitby/server test     # Run Vitest (no specs yet)
pnpm --filter @bitby/server lint     # ESLint for server sources
pnpm --filter @bitby/server typecheck
```

## Upcoming Tasks
- Implement REST `/auth/login` with JWT issuance and secure password hashing (§1).
- Stand up Redis + Postgres integrations for room state, catalog, and persistence (§12–13).
- Add realtime handlers for `auth`, `move`, `chat`, and catalog ops with full schema validation (§8).
- Expose Prometheus metrics and graceful restart workflows, including blocking reconnect overlays (§17–18).
