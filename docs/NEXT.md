# NEXT

<!-- This file is the single source of truth for what happens next.
     Keep bullets short. Update at the end of every session. -->

## Session Summary
- Suppressed unsupported TypeScript version warnings in the ESLint parser to match current tooling.
- Recorded ignored social mute/report broadcasts and surfaced informational toasts instead of silently discarding them.
- Expanded the client toast hook and styles to support an info tone used by moderation notices.
- Wired the admin quick menu visibility toggle into the realtime admin state store and dock UI.
- Added dedicated reducers and Vitest coverage for social mute/report broadcasts.
- Hardened the trade banner actions with inline loading indicators, guarded buttons, and a retry path for failed lifecycle calls.

## Next Actions (Top 5)
1. Add invite expiration and resend handling to the trade lifecycle banner.
2. Hook the admin quick menu buttons up to real server affordance endpoints.
3. Break down `packages/client/src/App.tsx` to isolate admin tooling from the primary render path.
4. Expand Vitest coverage around the trade banner flow to confirm the new expiration and resend paths.
5. Document the admin quick menu affordances so QA can validate the wired server endpoints.

## Quick Wins (High Impact, Low Effort)
- Document a hover affordance for disabled admin buttons to explain the required role.

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
- 2025-09-27 14:28 UTC — (pending) — Implemented admin quick menu toggle state and social broadcast reducers with tests
- 2025-09-27 15:28 UTC — (pending) — Added guarded trade banner actions with retry affordances
