# NEXT

<!-- This file is the single source of truth for what happens next.
     Keep bullets short. Update at the end of every session. -->

## Session Summary
- Cleared client lint issues by pruning unused imports and tightening social moderation event handling.

## Next Actions (Top 3)
1. Decide on a supported TypeScript version or relax the lint config mismatch warning.
2. Add coverage for social mute/report event reducers to prevent regressions.
3. Continue hardening trade lifecycle UI flows (loading states, retries).

## Quick Wins (High Impact, Low Effort)
- Surface a toast when a mute/report broadcast is ignored because it targets another user.

## Strategic Work (High Value, Higher Effort)
- Align real-time moderation tooling with persistent server state and auditing requirements.

## Carry-Over (Finish Next)
- Flesh out admin affordance toggles to cover all documented controls.

## Open Questions / Decisions Needed
- Should client builds pin to an @typescript-eslint supported compiler release or override the warning?

## Session Log
- 2025-09-27 12:15 UTC — 396e929 — Cleared client lint noise on social moderation events
