# Server Package (Planned)

This package hosts the Node.js (TypeScript) API/WebSocket authority for Bitby. The current build wires up Fastify with:

- `/healthz` and `/readyz` endpoints aligned with the Master Spec observability guardrails (§17)
- `POST /auth/login` which verifies the Argon2id hash for the seeded development users (`test`, `test2`, `test3`, `test4` all share `password123`), then issues an HS256 JWT containing the profile metadata and expiry window
- a WebSocket endpoint at `/ws` that enforces the `bitby.v1` subprotocol, caps payloads at 64 KB, validates the provided JWT, responds with `auth:ok` including the development room snapshot + heartbeat interval, echoes `ping`/`pong`, and closes sessions that miss the 30 s heartbeat window
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
- Persist issued JWTs + session metadata and extend `/auth/login` with rate limiting + telemetry.
- Stand up Redis + Postgres integrations for room state, catalog, and persistence (§12–13).
- Add realtime handlers for `move`, `chat`, and catalog ops with full schema validation (§8) and authoritative broadcast loops.
- Expose Prometheus metrics and graceful restart workflows, including blocking reconnect overlays (§17–18).
