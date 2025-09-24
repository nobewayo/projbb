# Bitby Project Setup & Running Guide (Windows & Linux)


This repository implements the Bitby platform following the **Master Spec v3.7**. The stack is now wired together as a pnpm monorepo with:

- a Vite + React client that now renders the deterministic top-right anchored grid preview with live hit-testing across the fixed 10-row field, keeps the right panel and bottom dock chrome locked to the new stage footprint, and surfaces a blocking reconnect overlay driven by the realtime WebSocket hook
- a Fastify-based server that now issues short-lived JWTs from `/auth/login`, seeds Argon2-hashed development users, and exposes a guarded `/ws` endpoint enforcing the `bitby.v1` subprotocol while validating tokens, streaming a development room snapshot, and servicing the heartbeat loop end to end
- shared schema utilities for the canonical WebSocket envelope (consumed by both client + server during the handshake)
- Docker Compose definitions for Postgres and Redis

This guide explains how to clone, run, and test the project on both Windows and Debian/Ubuntu-based Linux desktops. Windows-specific directions remain available in the second half of the document, while the next section walks through a complete Linux workflow tuned for Debian with the Xfce desktop.

> **Note:** The deterministic grid renderer now paints the full 10-row field (10 columns on even rows, 11 on odd rows) with a development HUD so geometry can be verified. The realtime hook authenticates with the server using the new `/auth/login` JWT flow, receives a stubbed-but-structured room snapshot (player seed plus NPC + tile flags), and shows the blocking reconnect overlay mandated by the spec whenever the socket drops. Avatars, movement, and authoritative state streaming remain placeholders so subsequent milestones can build atop the verified geometry and auth loop without breaking the guardrails.

---

## Linux (Debian/Xfce) Setup

The following instructions are tailored for Debian 12 (Bookworm) with the Xfce desktop, but they also work on Ubuntu 22.04+ and other apt-based derivatives. Use the automated script for the fastest path, or follow the manual steps if you prefer to install each dependency yourself.

### L1. System Requirements

- Debian 12/Ubuntu 22.04 (or later) with sudo access.
- At least 16 GB RAM is recommended for running the client, API, Postgres, and Redis simultaneously.
- A modern terminal emulator (Xfce Terminal is fine) with Git installed.

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

1. **API/WebSocket server**:
   ```bash
   pnpm --filter @bitby/server dev
   ```
   The server listens on `http://localhost:3001` with health checks and the `/auth/login` endpoint described later in this guide.
2. **Client (Vite + React)**:
   ```bash
   pnpm --filter @bitby/client dev
   ```
   The script rebuilds `@bitby/schemas` before launching Vite so shared types stay in sync.
3. **Schema watcher (optional but recommended when editing shared envelopes)**:
   ```bash
   pnpm --filter @bitby/schemas dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser. The deterministic grid preview, reconnect overlay, and development HUD behave the same as on Windows.

Environment overrides for Linux shells mirror the Windows instructions:

- `VITE_BITBY_WS_URL=ws://localhost:3001/ws pnpm --filter @bitby/client dev`
- `VITE_BITBY_DEV_TOKEN=<token> pnpm --filter @bitby/client dev`

### L6. Local Postgres & Redis via Docker

The Docker Compose file under `packages/infra/docker` works cross-platform.

```bash
cd packages/infra/docker
docker compose up -d
```

When finished, stop them with `docker compose down`. The services expose credentials documented in the compose file (`bitby/bitby`).

---

## Windows (PowerShell/GitHub Desktop) Setup

---

### 1. Prerequisites

#### 1.1 Hardware & OS
- Windows 10/11 64-bit with administrator access.
- At least 16 GB RAM recommended (for running API, WebSocket, Postgres, and Redis locally).

#### 1.2 Required Software

| Tool | Purpose | Download |
| --- | --- | --- |
| [GitHub Desktop](https://desktop.github.com/) | GUI Git client for cloning/pulling/committing. | Install via official installer |
| [Windows Terminal](https://www.microsoft.com/en-us/p/windows-terminal/9n0dx20hk701) or PowerShell | Shell for running local commands. | Microsoft Store |
| [Node.js 20 LTS](https://nodejs.org/en/download/) | Runtime for client & server packages. Includes `npm`. | Windows `.msi` installer |
| [pnpm](https://pnpm.io/installation) | Preferred package manager (`npm`-compatible). | `npm install -g pnpm` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) *(optional but recommended)* | Runs Postgres, Redis, and other services in containers. | Install via official installer |
| [Visual Studio Code](https://code.visualstudio.com/) *(optional)* | Editor with TypeScript tooling. | Official installer |

Ensure that after installing Node.js, running `node -v` and `npm -v` in PowerShell returns version numbers, then install pnpm globally:

```powershell
npm install -g pnpm
pnpm -v
```

---

### 2. Cloning the Repository via GitHub Desktop

1. Open **GitHub Desktop** and sign in with your GitHub account.
2. Click **File → Clone Repository…** and choose the **URL** tab.
3. Enter the repository URL (e.g., `https://github.com/<your-org>/projbb.git`).
4. Pick a local path (e.g., `C:\Projects\bitby`) and click **Clone**.
5. After cloning, click **Open in Visual Studio Code** (optional) or use Windows Terminal to navigate into the repository folder.


Whenever updates are pushed, use **Fetch origin** → **Pull** inside GitHub Desktop to stay current. After pulling, run `pnpm install` to sync dependencies if any package manifests changed.


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

---

## Running the Stack Locally (future-ready)

Two workflows are supported. Choose the one that fits your setup. The actual application code will introduce the commands referenced here.

### 4.1 pnpm (Native Windows, WSL, or Linux)

1. **Install dependencies** (run from the repository root after cloning or pulling):
   - PowerShell (Windows):
     ```powershell
     pnpm install
     ```
   - Bash (Linux/macOS/WSL):
     ```bash
     pnpm install
     ```
2. **Start the API/WebSocket server** (Fastify + JSON Web Tokens + `@fastify/websocket`):
   - PowerShell:
     ```powershell
     pnpm --filter @bitby/server dev
     ```
   - Bash:
     ```bash
     pnpm --filter @bitby/server dev
     ```
   The server listens on `http://localhost:3001` by default and exposes:
   - `GET /healthz` → `{ status: "ok" }`
   - `GET /readyz` → `{ status: "ready" }` once the process is accepting traffic (503 otherwise)
   - `POST /auth/login` → accepts `{ "username": "test", "password": "password123" }` style payloads, verifies the Argon2id hash for that seeded user (`test`, `test2`, `test3`, `test4` all share the development password), and returns `{ token, expiresIn, user }` where `token` is an HS256 JWT signed with the development secret
   - `GET /ws` (WebSocket) → only accepts connections that negotiate the `bitby.v1` subprotocol. The server validates the provided JWT, replies with `auth:ok` containing the seed profile, heartbeat interval, and a development room snapshot (player + NPC occupant, plus flagged tiles), answers `ping` with `pong`, and terminates idle sessions once the 30 s heartbeat window elapses.

   The React client now requests a token automatically when no `VITE_BITBY_DEV_TOKEN` override is supplied, but you can inspect the login response manually via PowerShell:

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3001/auth/login -Body (@{ username = 'test'; password = 'password123' } | ConvertTo-Json) -ContentType 'application/json'
   ```
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"test","password":"password123"}'
   ```

   The returned `token` value can be copied into `.env.local` as `VITE_BITBY_DEV_TOKEN` if you want to bypass the automatic login.

3. **Launch the client dev server** (Vite + React deterministic grid preview) in a separate terminal:
   - PowerShell:
     ```powershell
     pnpm --filter @bitby/client dev
     ```
   - Bash:
     ```bash
     pnpm --filter @bitby/client dev
     ```
   The client script now runs a pre-step that builds the shared `@bitby/schemas` workspace before Vite boots. This guarantees the
   generated `dist/index.js` exists even on fresh clones or after dependency churn, eliminating the "Failed to resolve
   import '@bitby/schemas'" error that Vite reported previously. If you are iterating on schema definitions, start a watcher in a
   third terminal so edits rebuild automatically:
   ```powershell
   pnpm --filter @bitby/schemas dev
   ```
   ```bash
   pnpm --filter @bitby/schemas dev
   ```
   Leave the watcher running while the client is open so TypeScript output stays in sync.
4. Open the client URL at [http://localhost:5173](http://localhost:5173) once Vite reports it is ready. The client now renders the full 10-row deterministic grid (10 columns on even rows, 11 on odd rows) anchored to the canvas’ top-right corner, with a 50 px top gutter, 25 px gutters on the left/right, and no bottom padding so every diamond clears the chrome. It highlights the tile under the pointer via the canonical diamond hit test and overlays a development HUD displaying the tile coordinate, tile center, and pointer pixel location. Stage chrome stays pixel-perfect (875 px canvas + 500 px panel + 290 px chat drawer) while the chat drawer, admin quick menu, and primary menu continue to follow the Master Spec interactions outlined below. The canvas background stretches flush between the top status bar and bottom dock with no vertical whitespace, the bottom dock keeps only its bottom-left corner rounded while hugging the canvas width exactly, and the right panel now runs square corners except for the rounded bottom-right seam that meets the dock. If the realtime socket drops, the spec-mandated blocking overlay covers the entire stage until the authenticated connection is restored.

> **Tip:** If you prefer WSL2 for better Node/Docker performance, clone the repo within the WSL filesystem (e.g., `/home/<user>/projbb`). GitHub Desktop can open the project in WSL by selecting “Open in Windows Terminal” and choosing a WSL profile.

### 4.2 Windows Quick Launcher (optional)

To start both the Fastify server and Vite client at once on Windows, run the helper script from the repository root:

```powershell
./start-windows.ps1
```


The launcher now detects whether the workspace has been bootstrapped—if `node_modules` is missing it automatically runs `pnpm install` before spawning the dev servers. Pass `-InstallDependencies` at any time to force a fresh install.

Prefer double-clicking? Use the companion batch file instead of opening PowerShell manually:

```batch
start-windows.bat
```

Both entry points open two new PowerShell windows—one for the server and one for the client—so logs remain easy to follow per the observability guidelines in the Master Spec.

### 4.3 Realtime client configuration (development)

The React client reads two environment variables when booting the Vite dev server:

- `VITE_BITBY_WS_URL` — optional override for the WebSocket endpoint. Defaults to `ws://localhost:3001/ws` when unset.
- `VITE_BITBY_DEV_TOKEN` — placeholder token forwarded in the `auth` envelope. Defaults to `local-development-token`.

Set them in a `.env.local` file at the repository root or prefix them inline when running `pnpm --filter @bitby/client dev`.

### 4.4 Docker (database + cache services)

The initial Docker Compose stack located at `packages/infra/docker/docker-compose.yml` starts Postgres and Redis with development-safe defaults.

1. Ensure Docker Desktop is running.
2. From Windows Terminal (PowerShell) in the repo root, run:
   ```powershell
   cd packages\infra\docker
   docker compose up -d
   ```
3. Services start with the credentials shown in the compose file (`bitby/bitby`). When you are done, stop them with:
   ```powershell
   docker compose down
   ```
4. To wipe persistent volumes, run `docker compose down -v`.

Future updates will add API, WebSocket, and client containers that bind to the same network for end-to-end testing.

---

## Testing

Testing harnesses are gradually rolling out. The current scripts already wire up TypeScript builds, Vitest, and ESLint across packages:

```powershell
# Ensure generated schema typings exist before type checking
pnpm --filter @bitby/schemas build

pnpm test

pnpm lint
pnpm typecheck

# Run package builds (emits dist/ for server + schemas)
pnpm build
```

When Docker-based services are required (e.g., Postgres), Compose files will include seeded data. Integration tests will automatically connect to those containers when run via `pnpm test`.

---

## Environment Variables & Secrets

Once server packages are committed, sample `.env.example` files will be added. Typical variables include:

```
POSTGRES_URL=postgres://bitby:bitby@localhost:5432/bitby
REDIS_URL=redis://localhost:6379
JWT_SECRET=<development-only-secret>
ASSET_CDN_BASE=http://localhost:8080/assets
VITE_BITBY_WS_URL=ws://localhost:3001/ws
VITE_BITBY_HTTP_URL=http://localhost:3001
VITE_BITBY_DEV_USERNAME=test
VITE_BITBY_DEV_PASSWORD=password123
VITE_BITBY_DEV_TOKEN=
```

Copy the template to `.env.local` (git-ignored) and adjust values for your machine. Leaving `VITE_BITBY_DEV_TOKEN` blank instructs the client to call `/auth/login` with the provided username/password; populate it only if you want to force a pre-issued JWT instead of using the automatic login helper.

---

## Keeping in Sync with the Master Spec

- The **Master Spec.md** file in the repository root is the authoritative design document. Review it before contributing changes.
- Non-negotiable requirements—grid determinism, top-right anchoring, WSS subprotocol enforcement, server authority—must be preserved in every feature.
- Deviations must be explicitly approved and noted via code comments referencing the request.

---

## Troubleshooting Tips (Windows)

| Issue | Resolution |
| --- | --- |
| `pnpm` not recognized | Reopen your terminal after `npm install -g pnpm`, or ensure `C:\Users\<you>\AppData\Roaming\npm` is on the PATH. |
| Ports already in use | Stop conflicting services (`Get-Process -Id (Get-NetTCPConnection -LocalPort <port>).OwningProcess`). |
| Docker WSL integration errors | Enable **Use the WSL 2 based engine** in Docker Desktop settings and ensure your Linux distro is checked under **Resources → WSL Integration**. |
| File permission mismatch between Windows & WSL | Prefer keeping the project within WSL’s filesystem for Node/Docker workloads. |
| Vite fails to resolve `@bitby/schemas` | Start the client via `pnpm --filter @bitby/client dev` so the automatic prebuild runs, or run `pnpm --filter @bitby/schemas build` manually once. |

---

## Next Steps in the Roadmap


1. Layer optimistic avatar movement + snapback logic on top of the deterministic grid renderer (Master Spec §2–3).
2. Replace the stubbed realtime handshake with JWT-backed auth, authoritative room snapshots, and movement/chat broadcast loops (§1, §3, §8).
3. Bring up Postgres/Redis migrations and seed data via Docker Compose (§12, §13, §21).
4. Establish automated testing harnesses (unit, integration, visual goldens) and CI workflows that exercise the heartbeat + reconnect flow.
5. Expand the schemas package with JSON Schemas/OpenAPI definitions covering realtime operations and REST endpoints (§23).


Progress will be tracked in future commits; this document will evolve with concrete commands as they become available.

---

## Support & Contribution Guidelines

- Use GitHub issues to track tasks aligned with Master Spec milestones.
- Submit pull requests referencing the relevant sections of the spec.
- Run the documented tests before opening a PR; attach logs to the PR description.
- Follow the coding guidelines in `AGENT.md` and comment intent for non-obvious logic (especially around grid math and server authority).

---

*Last updated: 2025-09-23 UTC*
