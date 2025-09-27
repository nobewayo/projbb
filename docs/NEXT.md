# NEXT

<!-- This file is the single source of truth for what happens next.
     Keep bullets short. Update at the end of every session. -->

## Session Summary
- Suppressed unsupported TypeScript version warnings in the ESLint parser to match current tooling.
- Recorded ignored social mute/report broadcasts and surfaced informational toasts instead of silently discarding them.
- Expanded the client toast hook and styles to support an info tone used by moderation notices.

## Next Actions (Top 3)
1. Design and implement the admin quick menu toggle flow described in AGENT section 3, wiring it to the existing admin state store.
2. Add coverage for social mute/report event reducers to prevent regressions.
3. Continue hardening trade lifecycle UI flows (loading states, retries).

## Quick Wins (High Impact, Low Effort)
- Surface a toast when a mute/report broadcast is ignored because it targets another user.

## Strategic Work (High Value, Higher Effort)
- Align real-time moderation tooling with persistent server state and auditing requirements.
- Break down `packages/client/src/App.tsx` into smaller domain-focused modules (movement loop, context menus, admin tools, chat) so each surface stays under 300 lines and pairs naturally with module tags.
- Implement staged realtime catalog deltas with signed caches and HMAC validation so the client can apply updates without a full snapshot on every reconnect.

## Carry-Over (Finish Next)
- Flesh out admin affordance toggles to cover all documented controls.

## Open Questions / Decisions Needed
- Should client builds pin to an @typescript-eslint supported compiler release or override the warning?

## Session Log
- 2025-09-27 12:15 UTC — 396e929 — Cleared client lint noise on social moderation events
- 2025-09-27 13:28 UTC — (pending) — Disabled TypeScript lint mismatch warning and added moderation ignore toasts
