# Server Package (Planned)

This package will host the Node.js (TypeScript) API and WebSocket authority for Bitby. It must enforce the `bitby.v1` subprotocol, JWT auth, movement validation, catalog distribution, and Redis-backed room state as described in Master Spec v3.7 §§1, 8–15, 17–18.

## Upcoming Tasks
- Scaffold REST `/auth/login` and WebSocket handlers with JSON Schema validation.
- Integrate Postgres schema and Redis presence caches defined in §12–13.
- Implement movement, chat, and item ops with roomSeq tracking and rate limits.
- Expose health checks, Prometheus metrics, and graceful restart hooks.
