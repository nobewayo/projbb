# Bitby Project Setup & Running Guide (Windows)

This repository implements the Bitby platform following the **Master Spec v3.7**. The codebase is still in its early scaffolding phase; this guide explains how to clone, run, and test the project on a Windows PC using either the GitHub Desktop GUI or Docker-based tooling as features come online.

> **Note:** The deterministic grid canvas and gameplay systems described in the Master Spec are not yet fully implemented. The steps below prepare your environment so you can pull updates and run services as they are added.

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

Whenever updates are pushed, use **Fetch origin** → **Pull** inside GitHub Desktop to stay current.

---

## 3. Project Structure (in progress)

```
projbb/
├─ Master Spec.md           # Canonical product & technical spec (do not modify without approval)
├─ README.md                # This setup guide
├─ packages/                # (planned) workspace packages for client, server, schemas, infra
│  ├─ client/               # (pending) Web client canvas + UI implementation
│  ├─ server/               # (pending) Node.js API + WebSocket authority
│  ├─ schemas/              # (pending) JSON Schemas & OpenAPI definitions
│  └─ infra/                # (pending) Docker Compose & deployment tooling
└─ ... (additional files will be added as milestones progress)
```

As development advances, `pnpm` workspaces will manage the monorepo with shared tooling (ESLint, TypeScript configs, etc.).

---

## 4. Running the Stack Locally (future-ready)

Two workflows are supported. Choose the one that fits your setup. The actual application code will introduce the commands referenced here.

### 4.1 pnpm (Native Windows or WSL)

1. **Install dependencies** (once `package.json` files land):
   ```powershell
   pnpm install
   ```
2. **Build TypeScript** (placeholder command; will be defined in workspace package scripts):
   ```powershell
   pnpm build
   ```
3. **Start services**:
   ```powershell
   # Launch the API/WS server (planned script name)
   pnpm --filter @bitby/server dev

   # In a separate terminal, run the client dev server (planned script name)
   pnpm --filter @bitby/client dev
   ```
4. Open the client URL (typically `http://localhost:5173`) in your browser once the client dev server reports it is ready.

> **Tip:** If you prefer WSL2 for better Node/Docker performance, clone the repo within the WSL filesystem (e.g., `/home/<user>/projbb`). GitHub Desktop can open the project in WSL by selecting “Open in Windows Terminal” and choosing a WSL profile.

### 4.2 Docker (Recommended once services exist)

Docker Compose files will live under `packages/infra/docker/`.

1. Ensure Docker Desktop is running.
2. From Windows Terminal (PowerShell) in the repo root, run:
   ```powershell
   cd packages\infra\docker
   docker compose up --build
   ```
3. Compose will launch Postgres, Redis, API, and client containers using the configurations defined in upcoming commits.
4. Press `Ctrl+C` to stop. Use `docker compose down -v` to remove containers and volumes if you need a clean slate.

---

## 5. Testing

Testing harnesses will be added in tandem with each milestone. Expect the following commands to become available:

```powershell
# Run all unit and integration tests across the workspace
pnpm test

# Lint + TypeScript checks
pnpm lint
pnpm typecheck

# Future: Visual regression / golden tests for deterministic canvas
pnpm test:visual
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

1. Scaffold `pnpm` workspace with shared configurations.
2. Implement deterministic grid renderer and movement loop per Master Spec §2–3.
3. Add WebSocket skeleton with `auth` handshake and heartbeat per §1.
4. Bring up Postgres/Redis via Docker Compose and seed baseline data (§12, §13, §21).
5. Establish testing harness (unit, integration, visual goldens) and CI workflows.

Progress will be tracked in future commits; this document will evolve with concrete commands as they become available.

---

## 10. Support & Contribution Guidelines

- Use GitHub issues to track tasks aligned with Master Spec milestones.
- Submit pull requests referencing the relevant sections of the spec.
- Run the documented tests before opening a PR; attach logs to the PR description.
- Follow the coding guidelines in `AGENT.md` and comment intent for non-obvious logic (especially around grid math and server authority).

---

*Last updated: 2025-09-23 UTC*
