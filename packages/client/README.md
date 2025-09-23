# Client Package (Planned)

This package hosts the Bitby web client implemented with React + Vite as a staging ground for the deterministic grid renderer, chrome, and realtime UX described in Master Spec v3.7 §§2–7, 16, and Appendix A. The current commit renders the required stage layout (canvas placeholder, right panel, sliding dock) so that future work can drop in the deterministic canvas without reflowing chrome.

## Scripts

```bash
pnpm --filter @bitby/client dev      # Start Vite dev server on http://localhost:5173
pnpm --filter @bitby/client build    # Type-check and build the production bundle
pnpm --filter @bitby/client test     # Run Vitest (jsdom)
pnpm --filter @bitby/client lint     # ESLint with shared repo rules
```

## Upcoming Tasks
- Implement the top-right anchored diamond grid renderer with deterministic hit-testing.
- Stream movement/chat state from the authoritative server (optimistic moves + snapback).
- Flesh out right panel views (chat log, item info, profile) and slide-left dock interactions per Appendix A.
- Integrate asset loading, avatar paper-doll compositing, and chat bubbles with cache budgets from the Master Spec.
