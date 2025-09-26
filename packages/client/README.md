# Client Package (Planned)

This package hosts the Bitby web client implemented with React + Vite as a staging ground for the deterministic grid renderer, chrome, and realtime UX described in Master Spec v3.7 §§2–7, 16, and Appendix A. The current build now renders the full 10-row, top-right anchored diamond grid (even rows show 10 columns, odd rows show 11; `tileW=75`, `tileH=90`) with a development HUD that surfaces tile coordinates, center points, and pointer pixels using the canonical hit test, while preserving the fixed chrome (right panel, bottom dock, chat drawer) for future realtime layers. The stage tokens keep the canvas flush between the top bar and bottom dock, apply a 50 px top gutter with 25 px gutters on the left/right (no bottom padding), lock the canvas width to 875 px, and ensure resizing the browser never introduces whitespace. The bottom dock now shares the canvas width exactly while keeping only its bottom-left corner rounded, and the right panel spans the canvas and dock stack with square edges everywhere except the rounded bottom-right seam. The realtime hook now performs the `/auth/login` handshake automatically (defaulting to the `test` seed user with password `password123`), validates the HS256 JWT returned by the server, caches the heartbeat interval advertised via `auth:ok`, and drives the spec-mandated blocking reconnect overlay whenever the socket drops until a validated session is restored.

## Scripts

```bash
pnpm --filter @bitby/client dev      # Start Vite dev server on http://localhost:5173
pnpm --filter @bitby/client build    # Type-check and build the production bundle
pnpm --filter @bitby/client test     # Run Vitest (jsdom)
pnpm --filter @bitby/client lint     # ESLint with shared repo rules
```

## Development auth helpers

- `VITE_BITBY_DEV_USERNAME` / `VITE_BITBY_DEV_PASSWORD` (default: `test` / `password123`) configure the automatic login helper that calls `POST /auth/login` before opening the WebSocket.
- `VITE_BITBY_DEV_TOKEN` (optional) can hold a pre-issued JWT if you prefer to bypass the login step; leave it blank to allow the helper to request fresh tokens as needed.
- `VITE_BITBY_HTTP_URL` overrides the REST origin when the API is not running on `http://localhost:3001`.

## Upcoming Tasks
- Layer optimistic avatar movement, snapback handling, and sprite ordering atop the grid renderer.
- Stream movement/chat state from the authoritative server (optimistic moves + snapback).
- Flesh out right panel views (chat log, item info, profile) and slide-left dock interactions per Appendix A.
- Integrate asset loading, avatar paper-doll compositing, and chat bubbles with cache budgets from the Master Spec.
