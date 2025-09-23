# Client Package (Planned)

This package hosts the Bitby web client implemented with React + Vite as a staging ground for the deterministic grid renderer, chrome, and realtime UX described in Master Spec v3.7 §§2–7, 16, and Appendix A. The current build now renders the full 10-row, top-right anchored diamond grid (even rows show 10 columns, odd rows show 11; `tileW=75`, `tileH=90`) with a development HUD that surfaces tile coordinates, center points, and pointer pixels using the canonical hit test, while preserving the fixed chrome (right panel, bottom dock, chat drawer) for future realtime layers. The stage tokens keep the canvas flush between the top bar and bottom dock, apply a 50 px top gutter with 25 px gutters on the left/right (no bottom padding), lock the canvas width to 875 px, and ensure resizing the browser never introduces whitespace. The bottom dock now shares the canvas width exactly while keeping only its bottom-left corner rounded, and the right panel spans the canvas and dock stack with square edges everywhere except the rounded bottom-right seam.

## Scripts

```bash
pnpm --filter @bitby/client dev      # Start Vite dev server on http://localhost:5173
pnpm --filter @bitby/client build    # Type-check and build the production bundle
pnpm --filter @bitby/client test     # Run Vitest (jsdom)
pnpm --filter @bitby/client lint     # ESLint with shared repo rules
```

## Upcoming Tasks
- Layer optimistic avatar movement, snapback handling, and sprite ordering atop the grid renderer.
- Stream movement/chat state from the authoritative server (optimistic moves + snapback).
- Flesh out right panel views (chat log, item info, profile) and slide-left dock interactions per Appendix A.
- Integrate asset loading, avatar paper-doll compositing, and chat bubbles with cache budgets from the Master Spec.
