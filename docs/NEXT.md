# NEXT

<!-- This file is the single source of truth for what happens next.
     Keep bullets short. Update at the end of every session. -->

## Session Summary
- Added module header tags across the server bootstrap/auth stack and tightened shutdown handling.
- Trimmed unused client imports discovered by lint and confirmed the workspace lint suite passes.

## Next Actions (Top 3)
1. Extend header tag coverage to the remaining server data-access modules.
2. Add targeted tests for realtime connection lifecycle edge cases (reconnect, social events).
3. Capture admin/dev affordance defaults in the docs for quicker onboarding.

## Quick Wins (High Impact, Low Effort)
- Document the websocket heartbeat/backoff values alongside the client hook.

## Strategic Work (High Value, Higher Effort)
- Establish a metrics ingestion plan so new telemetry emitted by the server runtime is observable.

## Carry-Over (Finish Next)
- Align the chat drawer styling tokens with the stage layout spec.

## Open Questions / Decisions Needed
- None.

## Session Log
- 2025-09-27 11:12 UTC — b5bd688 — Normalize server tags and clean unused imports
