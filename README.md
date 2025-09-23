# Bitby Developer Guide

This monorepo tracks the Bitby implementation described in **Master Spec v3.7**. It now includes:

- a Vite + React client that renders the deterministic, top-right anchored 10-row grid preview with diamond hit-testing and HUD readouts
- a Fastify-based API/WebSocket skeleton that enforces the `bitby.v1` subprotocol, readiness gates, and health endpoints
- shared schema utilities that expose the canonical WebSocket envelope via Zod
- Docker Compose tooling for local Postgres + Redis services

> **Status note:** Movement, catalog, chat, and avatar compositing are not implemented yet. The current build focuses on geometry correctness, layout fidelity, and server guardrails so that realtime features can be layered on without breaking the Master Spec’s non-negotiables.

---

## 1. Prerequisites

### Operating systems

- macOS 13+/Linux (native or WSL2) with Node.js 20 LTS
- Windows 10/11 (PowerShell 7+ recommended). WSL2 is strongly encouraged for Docker workloads.

### Required tooling

| Tool | Purpose |
| --- | --- |
| [Node.js 20 LTS](https://nodejs.org/) | Runtime for all packages. Includes `npm`.
| [pnpm 8](https://pnpm.io/installation) | Workspace package manager. Install with `npm install -g pnpm` after Node.
| [Git](https://git-scm.com/) | Version control. Any GUI/CLI client is fine.
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) *(optional for now)* | Provides Postgres + Redis containers used later in the roadmap.

Verify your environment once installed:

```bash
node -v
pnpm -v
```

---

## 2. Repository Layout (2025-09)

```
projbb/
├─ Master Spec.md           # Canonical product & technical spec (read-only)
├─ AGENT.md                 # Execution guardrails + status notes
├─ README.md                # You are here
├─ package.json             # Root scripts (lint/test/build/dev wrappers)
├─ pnpm-workspace.yaml      # Workspace definition
├─ packages/
│  ├─ client/               # Vite + React deterministic grid preview
│  ├─ server/               # Fastify API/WS skeleton with guardrails
│  ├─ schemas/              # Shared Zod schemas (WS envelope)
│  └─ infra/                # Docker Compose for Postgres + Redis
└─ start-windows.*          # Helper launchers for Windows
```

All packages are TypeScript-first and share compiler settings via `tsconfig.base.json`.

---

## 3. First-Time Setup

1. Clone the repository and `cd projbb`.
2. Install dependencies from the repo root:
   ```bash
   pnpm install
   ```
3. (Optional) Start the database/cache stack if you need Postgres/Redis:
   ```bash
   cd packages/infra/docker
   docker compose up -d
   ```
   Credentials: Postgres `bitby/bitby`; Redis uses the default DB with `volatile-lru` eviction.

The workspace is now ready for the dev servers below.

---

## 4. Running the Dev Servers

Open two terminals from the repository root:

```bash
# Terminal A – Fastify API/WebSocket skeleton
pnpm --filter @bitby/server dev

# Terminal B – Vite client
pnpm --filter @bitby/client dev
```

- The server listens on `http://localhost:3001`.
  - `GET /healthz` → `{ status: "ok" }`
  - `GET /readyz` → `{ status: "ready" }` once startup completes; otherwise 503 with `{ status: "starting" }`
  - `GET /ws` requires the `bitby.v1` subprotocol, echoes a placeholder system message, and closes with code `1012` until realtime handlers ship.
- The client dev server runs at [http://localhost:5173](http://localhost:5173). It renders:
  - the anchored 10-row diamond grid with the canonical hit-test
  - a HUD showing tile indices, tile centers, and pointer coordinates
  - fixed chrome (top bar, right panel, bottom dock, chat drawer, admin pill) matching the Master Spec layout tokens

### Windows helpers

PowerShell users can launch both processes via:

```powershell
./start-windows.ps1         # detects missing node_modules and installs automatically
```

Or double-click `start-windows.bat`, which spawns two PowerShell windows (server + client).

---

## 5. Testing & Quality Gates

Run workspace-wide checks from the repo root:

```bash
pnpm lint        # ESLint across all packages
pnpm typecheck   # Strict TypeScript builds
pnpm test        # Vitest placeholders (pass with no specs)
pnpm build       # Package builds (server+schemas emit to dist/)
```

Individual packages expose the same commands behind `pnpm --filter <name>`.

---

## 6. Environment Variables

Realtime features will require environment configuration. Expect the following keys once those modules land:

```
POSTGRES_URL=postgres://bitby:bitby@localhost:5432/bitby
REDIS_URL=redis://localhost:6379
JWT_SECRET=<development-only-secret>
ASSET_CDN_BASE=http://localhost:8080/assets
```

Sample `.env.example` files will be added alongside the relevant packages when the variables are consumed.

---

## 7. Current Implementation Snapshot

- ✅ Deterministic grid renderer with diamond hit-testing, HUD, and anchored chrome
- ✅ Fastify API skeleton with readiness gating, health endpoints, and strict WebSocket subprotocol enforcement
- ✅ Shared Zod schema for the realtime message envelope
- ✅ Docker Compose stack for Postgres + Redis (no application services yet)
- 🚧 Movement, catalog, chat, paper-doll rendering, and persistence remain unimplemented.

---

## 8. Immediate Next Steps

1. Implement the optimistic movement loop (client prediction + server validation + snapback) per Master Spec §§2–3.
2. Flesh out the WebSocket handshake (`auth`, heartbeat, `move`, `chat`) with JSON Schema validation (§§1, 8, 23).
3. Introduce Postgres/Redis integrations with migrations, seeds, and room authority plumbing (§§12–13, 21).
4. Expand the schemas package with operation-specific Zod/JSON Schemas and OpenAPI definitions for `/auth/login` (§23).
5. Add automated test coverage (grid math unit tests, server integration tests, visual goldens) and wire into CI (§18).

Keep the README updated as milestones land so the next engineer has an accurate handoff.

---

## 9. Troubleshooting

| Issue | Resolution |
| --- | --- |
| `pnpm` command missing | Re-open your shell after global install or ensure your global npm bin dir is on `PATH`. |
| Ports already in use | Kill the conflicting process (`lsof -i :5173` on macOS/Linux or `Get-NetTCPConnection` on Windows). |
| Docker fails on Windows | Enable the WSL 2 backend in Docker Desktop and ensure your distro is checked under **Resources → WSL Integration**. |
| Node dependency drift | Re-run `pnpm install` after pulling new changes; lockfile is authoritative. |

---

## 10. Contributing

- Review **Master Spec.md** and `AGENT.md` before coding. Non-negotiables (grid determinism, server authority, subprotocol enforcement) must never regress.
- Prefer small, well-scoped commits that reference relevant spec sections.
- Run the quality gates above before opening a PR and attach logs to the PR description.
- Document intent in code when implementing tricky geometry, snapback logic, or security-sensitive flows.

---

*Last updated: 2025-09-24 UTC*
