# Backlog

## Must fixes and gaps
- Harden the readiness controller to wait on Postgres migrations plus Redis pub/sub handshakes and fall back to 503 whenever those dependencies disconnect so the Pre-Cutover health checks stop flapping.
- Add regression coverage for the codemap generator so identical snapshots continue to reuse the previous `generatedAt` timestamp and keep the Codemap workflow green.

## Quick wins
- Document the Smoke workflow's screenshot artifact location in README so contributors can link it from PR discussions without digging through Actions runs.
- Annotate the remaining client hot-path files (GridCanvas, realtime hooks) with `@module` and `@tags` headers to improve codemap surfacing.

## Roadmap
- Break down `packages/client/src/App.tsx` into smaller domain-focused modules (movement loop, context menus, admin tools, chat) so each surface stays under 300 lines and pairs naturally with module tags.
- Design and implement the admin quick menu toggle flow described in AGENT section 3, wiring it to the existing admin state store.
- Implement the typed Green pre-cutover health checks runner once the server endpoints stabilise, wiring it into CI with retries per section 8 of AGENT.
