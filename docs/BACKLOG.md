# Backlog

## Must fixes and gaps
- Harden the readiness controller to wait on Postgres migrations plus Redis pub/sub handshakes and fall back to 503 whenever those dependencies disconnect so the Pre-Cutover health checks stop flapping.
- Add regression coverage for the codemap generator so identical snapshots continue to reuse the previous `generatedAt` timestamp and keep the Codemap workflow green.
- Build the scripted Green pre-cutover health check runner that calls `/healthz`, `/readyz`, `/metrics`, the synthetic WS handshake, and DB or Redis probes so we can gate cutovers per section 8 of the AGENT.

## Quick wins
- Annotate the shared schema websocket, REST, and OpenAPI contracts (for example `packages/schemas/src/ws/*.ts` and `packages/schemas/src/rest/*.ts`) with `@module` and `@tags` headers so codemap surfaces the realtime and HTTP payload definitions under the correct domains.
- Document the Smoke workflow's screenshot artifact location in README so contributors can link it from PR discussions without digging through Actions runs.
- Capture a lightweight readiness unit test that exercises `markNotReady` when downstream dependencies disconnect so we avoid regressions while hardening the controller.

## Roadmap
- Break down `packages/client/src/App.tsx` into smaller domain-focused modules (movement loop, context menus, admin tools, chat) so each surface stays under 300 lines and pairs naturally with module tags.
- Design and implement the admin quick menu toggle flow described in AGENT section 3, wiring it to the existing admin state store.
- Implement staged realtime catalog deltas with signed caches and HMAC validation so the client can apply updates without a full snapshot on every reconnect.
