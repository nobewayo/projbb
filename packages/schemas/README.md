# Schemas Package (Planned)

This package stores JSON Schemas and OpenAPI definitions used by both the client and server per Master Spec v3.7 §23. The initial module ships a Zod implementation of the canonical WebSocket envelope (`op`, `seq`, `ts`, `data`) so realtime handlers can validate payloads consistently.

## Scripts

```bash
pnpm --filter @bitby/schemas build    # Compile TypeScript to dist/
pnpm --filter @bitby/schemas test     # Run Vitest (placeholder)
pnpm --filter @bitby/schemas lint     # ESLint for schema sources
```

## Upcoming Tasks
- Define per-operation schemas for `auth`, `move`, `chat`, and catalog deltas with example payloads.
- Generate JSON Schema + TypeScript types for client/server validation and inference.
- Create OpenAPI 3.1 specs for `/auth/login` and additional REST endpoints.
- Provide CI scripts to validate schema changes and enforce backwards-compatibility guarantees.
