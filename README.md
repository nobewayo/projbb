# Bitby Project Setup & Running Guide (Linux)


This repository implements the Bitby platform following the **Master Spec v3.7**. The stack is now wired together as a pnpm monorepo with:

- a Vite + React client that renders the deterministic top-right anchored grid, keeps the blocking reconnect overlay mandated by the spec, streams authoritative chat history with a freeform composer that listens globally (type anywhere on the stage, press **Enter** to send, **Esc** to cancel), paints dev room items beneath avatars with click-through hit testing so the right panel can surface spec-compliant pickup gating copy, exposes spec-compliant right-click context menus for tiles, items, and avatars, and now hydrates persisted mute/report state, prunes muted occupants from the retained chat transcript, consumes Redis-backed social broadcasts, reacts to realtime trade lifecycle updates (invite/pending/accept/decline/cancel/complete) without redundant REST polls, replays the latest trade banner after reconnect, and composes the panel UI from extracted `ProfilePanel` / `InventoryCard` components driven by a reusable toast hook while keeping the visible chat window at an authoritative 200-message ceiling.
- a Fastify-based server backed by Postgres and Redis that issues short-lived JWTs from `/auth/login`, runs migrations/seeds on boot, exposes Socket.IO handlers for `auth`, `move`, and `chat`, publishes cross-instance chat via Redis, exports `/healthz`, `/readyz`, and `/metrics` endpoints instrumented with Prometheus counters, and now persists occupant mute/report actions so the realtime layer rehydrates social state on connect, fans out Redis-published moderation updates across every instance, broadcasts trade invitations/lifecycle updates to both participants, hydrates reconnect banners from the latest Postgres trade session, and prunes each room’s chat log to the most recent 200 entries immediately after persistence.
- a Vitest integration harness under `@bitby/server` that authenticates through `/auth/login`, drives heartbeat, typing, chat, movement, item pickup, trade lifecycle, and social moderation flows against Postgres/Redis (via Testcontainers or a locally installed stack using `BITBY_TEST_STACK`), plus focused React Testing Library suites for the new client components/hooks (remember to keep `@testing-library/jest-dom` installed in the client workspace).
- shared schema utilities covering the canonical realtime envelope plus JSON Schemas for `auth`, `move`, `chat`, and the new social payloads alongside an OpenAPI description of the `/auth/login` REST endpoint so both tiers validate identical payloads.
- Docker Compose definitions for Postgres/Redis plus a production build pipeline for the Fastify server and Vite client, including an optional Caddy reverse proxy that serves the React client over HTTPS while the API and data stores remain private on the Compose network.
- The admin quick menu is now wired to authoritative REST endpoints so toggling grid visibility, hidden-hover highlighting, move animations, tile `locked`/`noPickup` flags, and latency traces persists to Postgres and fans out via Redis-backed realtime events across every client, and a dedicated **Plant** action now spawns an Atrium Plant on your current tile through `/admin/rooms/:roomId/items/plant`.
- Admin REST endpoints now require an owner or moderator bearer token, stamp every successful action into an `audit_log` table with contextual metadata, and the Vitest integration harness exercises the tile-lock flow end-to-end (401/403 handling, realtime broadcast, and audit persistence).
- The right panel now includes an authoritative backpack summary that hydrates from the server’s inventory records and refreshes immediately on pickup acknowledgements while avatar context menus trigger the `/rooms/:roomId/occupants/:occupantId/*` REST endpoints to load profiles, bootstrap trades, and persist mute/report actions with server-side gating. The bottom dock exposes a dedicated **Backpack** toggle that swaps the panel heading and reveals the inventory immediately under the divider, keeping the idle state text-free per the updated UX requirements.
- Latest connected client screenshot (social state + realtime trade lifecycle banner): `browser:/invocations/frztrbea/artifacts/artifacts/connected-room.png`.

This guide explains how to clone, run, and test the project on Debian- or Ubuntu-based Linux desktops. The workflow below assumes an apt-based distribution (Debian 12 “Bookworm”, Ubuntu 22.04 “Jammy”, or newer) with sudo access.

> **Note:** The deterministic grid renderer still paints the full 10-row field (10 columns on even rows, 11 on odd rows) with the development background and HUD overlays, but the realtime hook now authenticates, maintains heartbeats, hydrates chat history, appends live `chat:new` envelopes alongside movement deltas, and surfaces realtime typing previews plus committed chat bubbles directly on the canvas. Item sprites render beneath avatars with alpha-aware hit tests so primary-button clicks now fall through to tile movement while the right-click context menu’s **Info** action is the only way to surface the item detail panel (which still shows “Kan ikke samle op her” vs. “Klar til at samle op” copy based on tile flags and the local avatar’s position). Persisted mute/report decisions flow back from the server on join, populate the profile drawer, and filter muted speakers from the chat log, while the trade banner now flows through the lifecycle REST acknowledgements (accept, decline/cancel, complete) so the UI mirrors authoritative responses. The server remains authoritative for `move`, `chat`, social state, and presence snapshots sourced from Postgres/Redis, and right-clicking tiles, items, or avatars spawns the spec-mandated context menus, including “Saml Op” buttons that only enable when the local avatar stands on a pickup-eligible tile. The chat drawer’s system-message toggle persists per user via the authoritative server preference store, the chat composer still runs entirely in the canvas (type anywhere to preview, Enter to send, Esc to cancel), and the admin quick menu now drives authoritative REST routes so grid/dev toggles, tile locks/no-pickups, and latency traces persist in Postgres and broadcast across Redis while the new **Plant** action drops an Atrium Plant onto the tile you currently occupy.

---

### Outstanding TODOs (hand-off)

1. Build the authoritative trade negotiation flow (server schema + client UI) so participants can propose inventory line items, review counteroffers, and finalize the exchange under server validation.
2. Persist and surface historical trade summaries (who traded, when, and what changed hands) so profiles/backpack history can expose authoritative trade logs.
3. Layer in time-based chat retention/archival (beyond the live 200-message ring) so muted/aged transcripts can be exported, audited, or aged out without bloating the primary table.

### Canvas chat controls (current build)

- **Type anywhere** — the composer listens globally, so any printable keypress (outside focused inputs) starts a preview bubble above your avatar.
- **Send with Enter** — pressing <kbd>Enter</kbd> submits the trimmed draft through the authoritative `chat:send` envelope.
- **Cancel with Esc** — pressing <kbd>Esc</kbd> clears the current draft locally and emits a `chat:typing` stop payload to the server.
- **Backspace editing** — standard editing keys (Backspace, character keys, space) update the preview in realtime while staying within the 120-character spec limit.

The chat drawer no longer carries a dedicated hint card—the composer lives exclusively on the canvas while the drawer focuses on history and the system-message toggle.

### Admin quick menu (authoritative toggles)

- **Role gating & audit trail** — Every admin endpoint now demands a bearer token from an `owner` or `moderator` account. Successful calls append a structured row to the `audit_log` table (including room, tile coordinates, and toggled values) before broadcasting the update across the realtime socket and Redis fan-out.
- **Grid/dev affordances** — tapping the grid, hidden-hover, or move animation buttons calls `POST /admin/rooms/:roomId/dev-affordances`, persisting to the new `room_admin_state` table and rebroadcasting through Redis so every client shares the same chrome state.
- **Tile locks/pickups** — the lock/no-pickup buttons operate on the tile your avatar currently occupies via `POST /admin/rooms/:roomId/tiles/:x/:y/(lock|no-pickup)`, keeping `room_tile_flag` in sync while the realtime socket updates all canvases immediately.
- **Latency traces** — the trace button triggers `POST /admin/rooms/:roomId/latency-trace`, stamps a fresh UUID/timestamp in Postgres, and emits a Redis event so other operator consoles see the request instantly.
- **Plant** — the plant button calls `POST /admin/rooms/:roomId/items/plant` to persist an Atrium Plant on your current tile, increments the authoritative `roomSeq`, and rebroadcasts the resulting `room:item_added` envelope so every client renders the new sprite immediately.

---

## Linux (Debian/Ubuntu) Setup

Use the automated script for the fastest path, or follow the manual steps if you prefer to install each dependency yourself.

### L1. System Requirements

- Debian 12/Ubuntu 22.04 (or later) with sudo access.
- At least 16 GB RAM is recommended for running the client, API, Postgres, and Redis simultaneously.
- A modern terminal emulator with Git installed.

### L2. Automated Bootstrap Script

The repository ships with `scripts/setup-linux.sh`, which installs the tooling stack (Node.js 20 LTS, pnpm via Corepack, Docker Engine + Compose, build essentials) and optionally runs `pnpm install` for you.

```bash
sudo ./scripts/setup-linux.sh
```

What the script does:

1. Verifies you are on an apt-based distribution and updates the package index.
2. Installs build prerequisites (`curl`, `git`, `gnupg`, `build-essential`, etc.).
3. Installs Node.js 20.x from NodeSource if an older version is detected.
4. Enables Corepack and activates the latest pnpm CLI.
5. Installs Docker Engine, Docker Compose, and related tooling, then adds your user to the `docker` group (log out/in afterwards so the membership takes effect).
6. Runs `pnpm install` from the repository root to hydrate the workspace dependencies.

Flags:

- `--skip-docker` — leave Docker untouched (useful on cloud VMs where Docker is pre-provisioned).
- `--skip-pnpm-install` — skip the workspace install if you only want to provision system dependencies.

Run `sudo ./scripts/setup-linux.sh --help` for the latest usage description.

### L3. Manual Install Steps (if you prefer)

Skip this section if you ran the script above.

1. Update apt and install prerequisites:
   ```bash
   sudo apt update
   sudo apt install -y ca-certificates curl git gnupg build-essential pkg-config
   ```
2. Install Node.js 20.x (replace `bookworm` with your codename if prompted):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
   sudo apt install -y nodejs
   ```
3. Enable Corepack and activate pnpm:
   ```bash
   sudo corepack enable
   corepack prepare pnpm@latest --activate
   pnpm --version
   ```
   (The second command runs as your normal user so the pnpm shim is available in your shell.)
4. Optional: Install Docker Engine + Compose:
   ```bash
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   sudo usermod -aG docker "$USER"
   ```
   Log out/in afterwards so your shell picks up the new `docker` group membership.

### L4. Clone the Repository (Linux)

1. Pick a workspace directory (e.g., `~/Projects`).
2. Clone via SSH or HTTPS:
   ```bash
   git clone https://github.com/<your-org>/projbb.git
   cd projbb
   ```
3. Install dependencies if the bootstrap script did not run it for you:
   ```bash
   pnpm install
   ```

### L5. Running the Stack on Linux

All commands below assume you are inside the repository root (`projbb/`). Use separate terminals/tabs for each long-running process.

1. **API / realtime server (Fastify + Socket.IO)** — ensure Postgres + Redis are running first (see L6) so migrations and Redis pub/sub can initialise:
   ```bash
   pnpm --filter @bitby/server dev
   ```
   The server listens on `http://localhost:3001`, runs migrations/seeds against Postgres on boot, exposes `/auth/login`, `/healthz`, `/readyz`, and `/metrics`, and bridges chat traffic through Redis pub/sub.
2. **Client (Vite + React)**:
   ```bash
   pnpm --filter @bitby/client dev
   ```
   The script rebuilds `@bitby/schemas` before launching Vite so shared types stay in sync.
3. **Schema watcher (optional but recommended when editing shared envelopes)**:
   ```bash
   pnpm --filter @bitby/schemas dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser. The deterministic grid preview, reconnect overlay, and development HUD mirror the spec-driven behavior described below.

Environment overrides for Linux shells:

- `VITE_BITBY_WS_URL=http://localhost:3001/ws pnpm --filter @bitby/client dev`
- `VITE_BITBY_DEV_TOKEN=<token> pnpm --filter @bitby/client dev`

### L6. Local Postgres & Redis via Docker

The Docker Compose file under `packages/infra/docker` works cross-platform.

```bash
cd packages/infra/docker
docker compose up -d
```

When finished, stop them with `docker compose down`. The services expose credentials documented in the compose file (`bitby/bitby`).

---

## Docker Compose (full stack on Debian/Ubuntu)

To run the production stack locally or on a self-managed VPS, follow [`Docker-Setup.md`](./Docker-Setup.md). The guide covers:

- installing Docker Engine + Compose on Debian/Ubuntu,
- cloning this repository and preparing the `.env` secrets file,
- building the Fastify server and Vite client images with the bundled Dockerfiles, and
- launching Postgres, Redis, the server, and the nginx-served client via `docker compose`.

The walkthrough uses `packages/infra/docker/docker-compose.full.yml`, which persists Postgres/Redis data in local volumes while publishing only the nginx-served client on port 8080. The API, Postgres, and Redis stay on the private Compose network and are proxied by nginx so nothing but the static client is reachable from the Internet.

#### L6b. Local Postgres & Redis without Docker (apt-based fallback)

If Docker is unavailable (for example, inside a constrained CI runner), you can install the database services directly on Debian/Ubuntu hosts:

```bash
sudo apt-get update
sudo apt-get install -y postgresql redis-server
sudo pg_ctlcluster 16 main start
redis-server --daemonize yes
sudo -u postgres psql -c "CREATE USER bitby WITH PASSWORD 'bitby';"
sudo -u postgres createdb -O bitby bitby
```

When finished, shut them down with:

```bash
redis-cli shutdown
sudo pg_ctlcluster 16 main stop
```

The server configuration expects the credentials shown above (`bitby/bitby`) and will connect to `127.0.0.1` on the default Postgres (5432) and Redis (6379) ports.

---

## Repository Structure (in progress)

```
projbb/
├─ Master Spec.md           # Canonical product & technical spec (do not modify without approval)
├─ README.md                # This setup guide
├─ pnpm-workspace.yaml      # Workspace definition (packages/*)
├─ package.json             # Root scripts (build, lint, dev, test)
├─ tsconfig.base.json       # Shared TypeScript compiler options
├─ packages/
│  ├─ client/               # Vite + React client with deterministic grid preview + chrome
│  ├─ server/               # Fastify API/WS skeleton enforcing spec guardrails
│  ├─ schemas/              # Shared Zod schemas (e.g., WS envelope)
│  └─ infra/                # Docker Compose and future deployment tooling
└─ ... (assets, migrations, and feature modules will land in future commits)
```

The repository uses `pnpm` workspaces to manage dependencies consistently across packages.

### Development art assets (current test fixtures)

When authoring or validating features that rely on placeholder art, reference the committed PNG sprites under the client asset tree:

- **Avatar sprites** live in `packages/client/src/assets/avatars/` and currently include `avatar1.png` and `avatar2.png`.
- **Item sprites** live in `packages/client/src/assets/items/` and currently include `plant.png` and `couch.png`.
- The development **room background** lives in `packages/client/src/assets/rooms/` as `dev_room.png`.

---

## Running the Stack Locally (future-ready)

The pnpm workspace drives all packages. Run the commands below from the repository root after cloning or pulling.

### 4.1 pnpm workflow (Linux)

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Start the API/Socket.IO server** (Fastify + JSON Web Tokens + `socket.io`):
   ```bash
   pnpm --filter @bitby/server dev
   ```

   The server listens on `http://localhost:3001` by default and exposes:
   - `GET /healthz` → `{ status: "ok" }`
   - `GET /readyz` → `{ status: "ready" }` once the process is accepting traffic (503 otherwise)
  - `POST /auth/login` → accepts `{ "username": "test", "password": "password123" }` style payloads, verifies the Argon2id hash for that seeded user (`test`, `test2`, `test3`, `test4` all share the development password), and returns `{ token, expiresIn, user }` where `token` is an HS256 JWT signed with the development secret. Roles are now seeded per spec (`test`→`owner`, `test2`→`moderator`, `test3`→`vip`, `test4`→`user`), and the admin REST surface only honours tokens from the owner/moderator cohorts.
   - `GET /rooms/:roomId/occupants/:occupantId/profile` and the companion `POST` endpoints for `/trade`, `/mute`, and `/report` → require an `Authorization: Bearer <JWT>` header and now persist trade bootstrap state, mute/report records, and profile snapshots through the server authority layer.
   - `Socket.IO /ws` namespace → validates the provided JWT from the `auth` envelope, replies with `auth:ok` containing the seed profile, heartbeat interval, and a development room snapshot (player + NPC occupant plus flagged tiles), answers `ping` with `pong`, and terminates idle sessions once the 30 s heartbeat window elapses.

   The React client now requests a token automatically when no `VITE_BITBY_DEV_TOKEN` override is supplied, but you can inspect the login response manually via curl:
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"test","password":"password123"}'
   ```
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"test","password":"password123"}'
   ```

  The returned `token` value can be copied into `.env.local` as `VITE_BITBY_DEV_TOKEN` if you want to bypass the automatic login.

  For manual REST checks against the new avatar actions, remember to pass the bearer token:
  ```bash
  curl -X GET http://localhost:3001/rooms/dev-room/occupants/11111111-1111-1111-1111-111111111202/profile \
    -H "Authorization: Bearer $TOKEN"
  ```
  Replace `$TOKEN` with the JWT returned from `/auth/login`.

3. **Launch the client dev server** (Vite + React deterministic grid preview) in a separate terminal:
   ```bash
   pnpm --filter @bitby/client dev
   ```
   The client script now runs a pre-step that builds the shared `@bitby/schemas` workspace before Vite boots. This guarantees the
   generated `dist/index.js` exists even on fresh clones or after dependency churn, eliminating the "Failed to resolve
   import '@bitby/schemas'" error that Vite reported previously. If you are iterating on schema definitions, start a watcher in a
   third terminal so edits rebuild automatically:
   ```bash
   pnpm --filter @bitby/schemas dev
   ```
   ```bash
   pnpm --filter @bitby/schemas dev
   ```
   Leave the watcher running while the client is open so TypeScript output stays in sync.
4. Open the client URL at [http://localhost:5173](http://localhost:5173) once Vite reports it is ready. The client now renders the full 10-row deterministic grid (10 columns on even rows, 11 on odd rows) anchored to the canvas’ top-right corner, with a 50 px top gutter, 25 px gutters on the left/right, and no bottom padding so every diamond clears the chrome. It highlights the tile under the pointer via the canonical diamond hit test and overlays a development HUD displaying the tile coordinate, tile center, and pointer pixel location. Stage chrome stays pixel-perfect (875 px canvas + 500 px panel + 290 px chat drawer) while the chat drawer, admin quick menu, and primary menu continue to follow the Master Spec interactions outlined below. The canvas background stretches flush between the top status bar and bottom dock with no vertical whitespace, the bottom dock keeps only its bottom-left corner rounded while hugging the canvas width exactly, and the right panel now runs square corners except for the rounded bottom-right seam that meets the dock. If the realtime socket drops, the spec-mandated blocking overlay covers the entire stage until the authenticated connection is restored.

### 4.2 Realtime client configuration (development)

The React client reads two environment variables when booting the Vite dev server:

- `VITE_BITBY_WS_URL` — optional override for the realtime endpoint. Provide an `http://`/`https://` origin (the client upgrades to WebSocket automatically) such as `http://localhost:3001/ws` when running locally.
- `VITE_BITBY_DEV_TOKEN` — placeholder token forwarded in the `auth` envelope. Defaults to `local-development-token`.

Set them in a `.env.local` file at the repository root or prefix them inline when running `pnpm --filter @bitby/client dev`.

### 4.3 Docker (database + cache services)

The initial Docker Compose stack located at `packages/infra/docker/docker-compose.yml` starts Postgres and Redis with development-safe defaults.

1. Ensure the Docker Engine service is running.
2. From the repo root, run:
   ```bash
   cd packages/infra/docker
   docker compose up -d
   ```
3. Services start with the credentials shown in the compose file (`bitby/bitby`). When you are done, stop them with:
   ```bash
   docker compose down
   ```
4. To wipe persistent volumes, run `docker compose down -v`.

Future updates will add API, Socket.IO, and client containers that bind to the same network for end-to-end testing.

---

## Testing

The workspace now ships a Postgres + Redis backed integration/E2E suite under `@bitby/server` that guards the realtime pipelines alongside the existing lint/typecheck flows.

### Test commands

```bash
# Rebuild shared schemas before type checking when packages changed
pnpm --filter @bitby/schemas build

# Run linting, type checking, and package builds
pnpm lint
pnpm typecheck
pnpm build

# Execute all package tests (delegates to each workspace)
pnpm test
```

### Realtime integration suite (Postgres + Redis)

The Vitest file at `packages/server/src/__tests__/realtime.integration.test.ts` exercises:

- `/auth/login` → websocket `auth:ok` handshake and heartbeat expectations (`ping`/`pong`).
- Typing previews and committed chat bubbles (canvas bubble previews → `chat:typing`, `chat:new`).
- Movement acknowledgements plus occupant broadcasts (`move:ok`, `room:occupant_moved`/`room:occupant_left`).
- Item pickup authority (`item:pickup:ok` → `room:item_removed`) to validate inventory persistence against Postgres.
- Admin tile locks requiring owner/moderator tokens, verifying 401/403 handling, realtime `admin:tile_flag:update` broadcasts, and the resulting audit log row.

Tests boot against real Postgres/Redis via one of two strategies:

1. **Docker / Testcontainers (default)** — set `BITBY_TEST_STACK=containers` (or leave the variable unset when Docker is available) and run:
   ```bash
   BITBY_TEST_STACK=containers pnpm --filter @bitby/server test
   ```
   The harness spins up disposable Postgres (`postgres:16-alpine`) and Redis (`redis:7-alpine`) containers, runs migrations, and tears them down after the suite.
2. **External services (apt-based fallback)** — if Docker is unavailable, start Postgres/Redis manually (see §L6b) and run:
   ```bash
   BITBY_TEST_STACK=external pnpm --filter @bitby/server test
   ```
   The tests connect to `127.0.0.1` on the standard ports using the `bitby/bitby` credentials and flush Redis between cases.

Running `pnpm test` from the repo root honours the same environment variable, so CI can opt into containerised services while individual developers can target their locally installed stack.

---

## Environment Variables & Secrets

Once server packages are committed, sample `.env.example` files will be added. Typical variables include:

```
POSTGRES_URL=postgres://bitby:bitby@localhost:5432/bitby
REDIS_URL=redis://localhost:6379
JWT_SECRET=<development-only-secret>
ASSET_CDN_BASE=http://localhost:8080/assets
VITE_BITBY_WS_URL=http://localhost:3001/ws
VITE_BITBY_HTTP_URL=http://localhost:3001
VITE_BITBY_DEV_USERNAME=test
VITE_BITBY_DEV_PASSWORD=password123
VITE_BITBY_DEV_TOKEN=
```

Copy the template to `.env.local` (git-ignored) and adjust values for your machine. Leaving `VITE_BITBY_DEV_TOKEN` blank instructs the client to call `/auth/login` with the provided username/password; populate it only if you want to force a pre-issued JWT instead of using the automatic login helper.

---

## Keeping in Sync with the Master Spec

- The **Master Spec.md** file in the repository root is the authoritative design document. Review it before contributing changes.
- Non-negotiable requirements—grid determinism, top-right anchoring, Socket.IO heartbeat/message limits, and server authority—must be preserved in every feature.
- Deviations must be explicitly approved and noted via code comments referencing the request.

---

## Next Steps in the Roadmap


1. Implement the full trade negotiation UX (proposal slots, confirmation flows, authoritative validation) so the current lifecycle banner escalates into an interactive exchange per spec §A.6.
2. Persist and surface post-trade summaries (participants, timestamps, exchanged items/coins) so moderation and profile views can reference authoritative trade history.
3. Expand chat polish: finish the timestamp hover delay, bubble animation polish, and cluster QA while layering in time-based transcript archival beyond the live 200-message window.
4. Continue rounding out client-side coverage for the profile/inventory/trade UI slices alongside toast/context-menu affordances.
5. Extend admin tooling toward the catalog/editor roadmap once trade + chat improvements land.


Progress will be tracked in future commits; this document will evolve with concrete commands as they become available.

---

## Handoff Notes (2025-09-26)

- The realtime hook now authenticates via `/auth/login`, keeps the heartbeat loop alive, restores the room snapshot, streams historical chat on join, appends live `chat:new` envelopes, and resets the blocking reconnect overlay while the chat composer listens globally (type anywhere, send with Enter, cancel with Esc) before emitting authoritative `chat:send` frames. Typing updates mirror to the server so canvas previews and sent chat bubbles render in realtime alongside the persisted system-message preference per user.
- The canvas draws seeded development items beneath avatars, maintains per-item hit boxes, and funnels item selections into the right panel where Danish pickup copy (“Kan ikke samle op her” / “Klar til at samle op”) reflects tile flags and the local avatar’s position while movement gating remains authoritative.
- The “Saml Op” action now issues real `item:pickup` envelopes. The server validates tile parity/noPickup flags, persists the transfer into `room_item`/`user_inventory_item`, increments `roomSeq`, and broadcasts `room:item_removed` while the client performs optimistic removal, shows pending/success/error copy, and restores the item on rejection. Tile, item, and avatar context menus mirror these gating rules so Info/Saml Op stay scoped to the active tile while avatar actions (profile, trade, mute, report) now call the authoritative `/rooms/:roomId/occupants/:occupantId/*` REST endpoints and surface server acknowledgements (including toast feedback and profile panel hydration).
- The Fastify server boots Postgres migrations/seeds, validates `auth`/`move`/`chat` envelopes, persists chat to Postgres, relays room chat via Redis pub/sub, and exposes `/healthz`, `/readyz`, and `/metrics` Prometheus counters alongside the `/auth/login` REST endpoint.
- Latest connectivity screenshot with chat + item panel: `browser:/invocations/bgilqaqf/artifacts/artifacts/connected-room.png`.
- Immediate follow-ups:
  - Promote the trade banner into the full negotiation flow (per-slot offers, confirmation, completion) with server validation and reconnect hydration.
  - Capture and expose authoritative trade history so moderation and profile views can inspect prior exchanges.
  - Finish chat polish (timestamp hover delay, bubble animation, retention instrumentation) now that the 200-message pruning baseline is in place.

---

## Support & Contribution Guidelines

- Use GitHub issues to track tasks aligned with Master Spec milestones.
- Submit pull requests referencing the relevant sections of the spec.
- Artwork, screenshots, and texture updates **must not** be generated with AI tools; request assets from design if you need new imagery and include explicit placement/size notes.
- Run the documented tests before opening a PR; attach logs to the PR description.
- Follow the coding guidelines in `AGENT.md` and comment intent for non-obvious logic (especially around grid math and server authority).

---

*Last updated: 2025-09-27 UTC*
