# Schemas Package (Planned)

This package will store JSON Schemas for WebSocket ops and OpenAPI definitions for REST endpoints in alignment with Master Spec v3.7 §23. Schemas must be versioned, include example payloads, and back client/server validation.

## Upcoming Tasks
- Define the shared schema tooling (AJV or similar) with TypeScript type generation.
- Author baseline schemas for `auth`, `move`, `chat`, and catalog deltas.
- Create OpenAPI 3.1 specs for `/auth/login` and future REST endpoints.
- Provide scripts to lint/validate schemas during CI.
