# Bitby Project Setup & Running Guide (Windows)


This repository implements the Bitby platform following the **Master Spec v3.7**. The stack is now wired together as a pnpm monorepo with:

- a Vite + React client shell that reserves the deterministic grid canvas, right panel, and bottom dock
- a Fastify-based server skeleton with `/healthz`, `/readyz`, and a guarded WebSocket endpoint enforcing the `bitby.v1` subprotocol
- shared schema utilities for the canonical WebSocket envelope
- Docker Compose definitions for Postgres and Redis

This guide explains how to clone, run, and test the project on a Windows PC using the GitHub Desktop GUI or Docker-based tooling.

> **Note:** The deterministic grid canvas and realtime gameplay systems are still stubs. The scaffolding below ensures the required services boot with the correct guardrails so features can be layered in incrementally.

---

## 1. Prerequisites

### 1.1 Hardware & OS
- Windows 10/11 64-bit with administrator access.
- At least 16 GB RAM recommended (for running API, WebSocket, Postgres, and Redis locally).

### 1.2 Required Software

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

## 2. Cloning the Repository via GitHub Desktop

1. Open **GitHub Desktop** and sign in with your GitHub account.
2. Click **File → Clone Repository…** and choose the **URL** tab.
3. Enter the repository URL (e.g., `https://github.com/<your-org>/projbb.git`).
4. Pick a local path (e.g., `C:\Projects\bitby`) and click **Clone**.
5. After cloning, click **Open in Visual Studio Code** (optional) or use Windows Terminal to navigate into the repository folder.


Whenever updates are pushed, use **Fetch origin** → **Pull** inside GitHub Desktop to stay current. After pulling, run `pnpm install` to sync dependencies if any package manifests changed.


---

## 3. Project Structure (in progress)

```
projbb/
├─ Master Spec.md           # Canonical product & technical spec (do not modify without approval)
├─ README.md                # This setup guide
├─ pnpm-workspace.yaml      # Workspace definition (packages/*)
├─ package.json             # Root scripts (build, lint, dev, test)
├─ tsconfig.base.json       # Shared TypeScript compiler options
├─ packages/
│  ├─ client/               # Vite + React client shell with placeholder canvas + chrome
│  ├─ server/               # Fastify API/WS skeleton enforcing spec guardrails
│  ├─ schemas/              # Shared Zod schemas (e.g., WS envelope)
│  └─ infra/                # Docker Compose and future deployment tooling
└─ ... (assets, migrations, and feature modules will land in future commits)
```

The repository uses `pnpm` workspaces to manage dependencies consistently across packages.

---

## 4. Running the Stack Locally (future-ready)

Two workflows are supported. Choose the one that fits your setup. The actual application code will introduce the commands referenced here.

### 4.1 pnpm (Native Windows or WSL)

1. **Install dependencies** (run from the repository root after cloning or pulling):
   ```powershell
   pnpm install
   ```
2. **Start the API/WebSocket server** (Fastify + `@fastify/websocket` skeleton):
   ```powershell
   pnpm --filter @bitby/server dev
   ```
   The server listens on `http://localhost:3001` by default and exposes:
   - `GET /healthz` → `{ status: "ok" }`
   - `GET /readyz` → `{ status: "ready" }` once the process is accepting traffic (503 otherwise)
   - `GET /ws` (WebSocket) → accepts only if the client specifies `bitby.v1`; immediately closes with `1012` until realtime handlers are implemented.

3. **Launch the client dev server** (Vite + React placeholder UI) in a separate terminal:
   ```powershell
   pnpm --filter @bitby/client dev
   ```
4. Open the client URL at [http://localhost:5173](http://localhost:5173) once Vite reports it is ready. The placeholder renders the chrome layout specified in the Master Spec while reserving the deterministic canvas for future commits.

> **Tip:** If you prefer WSL2 for better Node/Docker performance, clone the repo within the WSL filesystem (e.g., `/home/<user>/projbb`). GitHub Desktop can open the project in WSL by selecting “Open in Windows Terminal” and choosing a WSL profile.

### 4.2 Docker (database + cache services)

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

## 5. Testing

Testing harnesses are gradually rolling out. The current scripts already wire up TypeScript builds, Vitest, and ESLint across packages:

```powershell
pnpm test

pnpm lint
pnpm typecheck

# Run package builds (emits dist/ for server + schemas)
pnpm build
```

When Docker-based services are required (e.g., Postgres), Compose files will include seeded data. Integration tests will automatically connect to those containers when run via `pnpm test`.

---

## 6. Environment Variables & Secrets

Once server packages are committed, sample `.env.example` files will be added. Typical variables include:

```
POSTGRES_URL=postgres://bitby:bitby@localhost:5432/bitby
REDIS_URL=redis://localhost:6379
JWT_SECRET=<development-only-secret>
ASSET_CDN_BASE=http://localhost:8080/assets
```

Copy the template to `.env.local` (git-ignored) and adjust values for your machine.

---

## 7. Keeping in Sync with the Master Spec

- The **Master Spec.md** file in the repository root is the authoritative design document. Review it before contributing changes.
- Non-negotiable requirements—grid determinism, top-right anchoring, WSS subprotocol enforcement, server authority—must be preserved in every feature.
- Deviations must be explicitly approved and noted via code comments referencing the request.

---

## 8. Troubleshooting Tips (Windows)

| Issue | Resolution |
| --- | --- |
| `pnpm` not recognized | Reopen your terminal after `npm install -g pnpm`, or ensure `C:\Users\<you>\AppData\Roaming\npm` is on the PATH. |
| Ports already in use | Stop conflicting services (`Get-Process -Id (Get-NetTCPConnection -LocalPort <port>).OwningProcess`). |
| Docker WSL integration errors | Enable **Use the WSL 2 based engine** in Docker Desktop settings and ensure your Linux distro is checked under **Resources → WSL Integration**. |
| File permission mismatch between Windows & WSL | Prefer keeping the project within WSL’s filesystem for Node/Docker workloads. |

---

## 9. Next Steps in the Roadmap


1. Implement deterministic grid renderer and movement loop per Master Spec §2–3 within the new client shell.
2. Flesh out the WebSocket handshake (`auth`, heartbeats, move/chat ops) on top of the Fastify server (§1, §8).
3. Bring up Postgres/Redis migrations and seed data via Docker Compose (§12, §13, §21).
4. Establish automated testing harnesses (unit, integration, visual goldens) and CI workflows.
5. Expand the schemas package with JSON Schemas/OpenAPI definitions covering the realtime and REST protocols (§23).


Progress will be tracked in future commits; this document will evolve with concrete commands as they become available.

---

## 10. Support & Contribution Guidelines

- Use GitHub issues to track tasks aligned with Master Spec milestones.
- Submit pull requests referencing the relevant sections of the spec.
- Run the documented tests before opening a PR; attach logs to the PR description.
- Follow the coding guidelines in `AGENT.md` and comment intent for non-obvious logic (especially around grid math and server authority).

---

*Last updated: 2025-09-23 UTC*
