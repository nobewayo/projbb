# Bitby on Cosmos Cloud — Zero-SSH Docker Compose Deployment

> **Scope.** This guide explains how to deploy the Bitby stack on [Cosmos Cloud](https://cosmos-cloud.io) **entirely from the dashboard**. You only need a Cosmos server with Docker enabled and a domain (optional). The Compose bundle below provisions Postgres, Redis, the Bitby backend, the production web client, and a one-shot prep container that clones and builds the repository inside the cluster — no separate Git attachment or manual image builds are required.

---

## 1. What you need before you start

1. **Cosmos server:** Create (or pick) a server in Cosmos that has the Docker agent installed. All steps below happen from `Servers → <your server>`.
2. **Repository URL:** A HTTPS Git URL for the Bitby repo. Public repos can use the anonymous URL; private repos should embed a read-only personal access token (e.g. `https://<token>@github.com/your-org/bitby.git`).
3. **Secrets:** Generate the values you plan to use for:
   - `JWT_SECRET` — at least 32 random characters.
   - `POSTGRES_PASSWORD` — the password for the internal Postgres instance.
   - Optional: `CLIENT_ORIGIN` (final HTTPS domain) and `BITBY_REPO_REF` (branch or tag to deploy).

---

## 2. Use the Cosmos-ready Compose stack

Copy the following Compose file into the Cosmos **Docker Compose** editor. It is also stored at `packages/infra/docker/docker-compose.cosmos.yml` in the repository for reference.

```yaml
version: '3.9'

services:
  prep:
    image: node:20-bookworm
    restart: 'no'
    environment:
      BITBY_REPO_URL: ${BITBY_REPO_URL:-https://github.com/bitbyhq/bitby.git}
      BITBY_REPO_REF: ${BITBY_REPO_REF:-main}
    entrypoint: ['/bin/bash', '-lc']
    command: |
      set -euo pipefail
      apt-get update
      apt-get install -y --no-install-recommends git ca-certificates python3 build-essential
      rm -rf /var/lib/apt/lists/*
      rm -rf /workspace/repo
      git clone --depth=1 --branch "${BITBY_REPO_REF}" "${BITBY_REPO_URL}" /workspace/repo
      cd /workspace/repo
      corepack enable
      pnpm install --frozen-lockfile
      pnpm --filter @bitby/schemas build
      pnpm --filter @bitby/server build
      pnpm --filter @bitby/client build
    volumes:
      - bitby-source:/workspace

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: bitby
      POSTGRES_USER: bitby
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-bitby}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -d ${POSTGRES_DB:-bitby} -U ${POSTGRES_USER:-bitby}']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: ['redis-server', '--appendonly', 'no', '--save', '', '--maxmemory-policy', 'volatile-lru']
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

  server:
    image: node:20-bookworm
    restart: unless-stopped
    depends_on:
      prep:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3001
      LOG_LEVEL: info
      JWT_SECRET: ${JWT_SECRET:-change-me}
      CLIENT_ORIGIN: ${CLIENT_ORIGIN:-http://localhost}
      PGHOST: postgres
      PGPORT: 5432
      PGDATABASE: bitby
      PGUSER: bitby
      PGPASSWORD: ${POSTGRES_PASSWORD:-bitby}
      REDIS_URL: redis://redis:6379
    volumes:
      - bitby-source:/workspace
    working_dir: /workspace/repo
    entrypoint: ['/bin/bash', '-lc']
    command: |
      set -euo pipefail
      corepack enable
      pnpm --filter @bitby/server start
    expose:
      - '3001'

  client:
    image: nginx:1.25-alpine
    restart: unless-stopped
    depends_on:
      prep:
        condition: service_completed_successfully
      server:
        condition: service_started
    volumes:
      - bitby-source:/workspace:ro
    entrypoint: ['/bin/sh', '-c']
    command: |
      set -e
      cat <<'EONGINX' >/etc/nginx/conf.d/default.conf
      server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        gzip on;
        gzip_types text/plain text/css application/json application/javascript application/octet-stream image/svg+xml;

        location /ws {
          proxy_pass http://server:3001/ws;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "Upgrade";
          proxy_set_header Host $host;
          proxy_read_timeout 65;
        }

        location /auth/ {
          proxy_pass http://server:3001/auth/;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /admin/ {
          proxy_pass http://server:3001/admin/;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /metrics {
          proxy_pass http://server:3001/metrics;
          proxy_set_header Host $host;
          proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /readyz {
          proxy_pass http://server:3001/readyz;
        }

        location /healthz {
          proxy_pass http://server:3001/healthz;
        }

        location / {
          try_files $uri $uri/ /index.html;
        }
      }
      EONGINX
      rm -rf /usr/share/nginx/html/*
      cp -r /workspace/repo/packages/client/dist/* /usr/share/nginx/html/
      exec nginx -g 'daemon off;'
    expose:
      - '80'

volumes:
  bitby-source:
  postgres-data:
  redis-data:
```

**How it works.**
- `prep` runs once on each deployment, cloning the repo, installing dependencies, and producing the server/client builds on a shared Docker volume.
- `server` and `client` reuse that volume so the Node runtime runs compiled TypeScript while nginx serves the bundled React app. The nginx config forwards API and websocket traffic back to the internal server container.
- `postgres` and `redis` stay private inside the Compose network; only the `client` service is published through Cosmos.

---

## 3. Create the deployment from the Cosmos dashboard

1. Sign in to Cosmos and open **Servers → <your server>**.
2. Click **Deployments → New Deployment → Docker Compose**.
3. Give the deployment a name such as `bitby-prod`.
4. Choose an appropriate compute profile for each service (Cosmos lets you override resources later).
5. Paste the Compose file from §2 into the editor and save.

Cosmos stores the Compose definition directly with the deployment; there is no separate "project" or Git attachment step required.

---

## 4. Configure environment variables in Cosmos

1. Inside the deployment view open the **Environment** panel.
2. Add the required variables (mark sensitive values as *secret*):
   - `JWT_SECRET` → your random secret.
   - `POSTGRES_PASSWORD` → password for the Postgres container.
   - `CLIENT_ORIGIN` → final HTTPS origin for the site (e.g. `https://play.example.com`). You can update this after you bind the domain.
   - `BITBY_REPO_URL` → HTTPS URL for the repository. Use a tokenised URL if the repo is private.
   - Optional: `BITBY_REPO_REF` → branch/tag to deploy (defaults to `main`).
3. Save the environment. Cosmos will inject the same variables into any service that references them in the Compose file.

---

## 5. Publish the web client via **URLs & Ports**

1. Navigate to the deployment’s **URLs & Ports** tab.
2. Click **Add URL** (or **Expose Port**) and configure:
   - **Service:** `client`
   - **Container Port:** `80`
   - **Protocol:** HTTPS (enable the automatic Let’s Encrypt certificate).
   - **Domain / Subdomain:** choose a managed domain or generate a Cosmos subdomain.
   - Enable **Websocket support** so `/ws` upgrades reach the backend.
3. Save the URL mapping. Leave the `server`, `postgres`, and `redis` services unexposed so they remain private inside the Compose network.

If you need to expose the Fastify metrics endpoint separately, add another URL that points to `client` with the route path `/metrics` (nginx forwards it internally).

---

## 6. Deploy and verify

1. From the deployment overview click **Deploy**. Cosmos will start the `prep` job first and stream the logs; expect the initial build to take several minutes while pnpm installs dependencies.
2. Once `prep` exits successfully, Cosmos will launch `postgres`, `redis`, `server`, and `client`.
3. Use the **Logs** tab to confirm each service is healthy:
   - `postgres` prints `database system is ready to accept connections`.
   - `redis` logs `Ready to accept connections`.
   - `server` logs `Server is listening` on port 3001 after migrations run.
   - `client` logs the nginx startup banner.
4. Open the public URL you configured. The Bitby canvas should render, the reconnect overlay should clear, and chat/presence should function. Because nginx proxies `/ws`, no additional firewall rules are needed.

---

## 7. Updating the stack

- **Code updates:** change `BITBY_REPO_REF` (or push new commits to the referenced branch) and click **Redeploy**. The `prep` job re-clones the repo on every deployment to pick up changes.
- **Secrets:** edit the values in the **Environment** panel and redeploy so Cosmos restarts the services with the new secrets.
- **Scaling:** adjust CPU/RAM allocations per service from the deployment sidebar. Scale horizontally by adding replicas to the `client` service; keep `server` at a single replica unless you introduce Redis-based session affinity for realtime traffic.
- **Backups:** schedule Cosmos volume snapshots for `postgres-data`. You can also open the `postgres` console in the dashboard and run `pg_dump` or `psql` commands without SSH.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `prep` fails with `fatal: could not read Username` | Private repo without embedded token | Set `BITBY_REPO_URL` to include a PAT (e.g. `https://token@github.com/org/bitby.git`). Redeploy. |
| Browser stuck on reconnect overlay | `CLIENT_ORIGIN` mismatch causing CORS/WebSocket rejection | Update `CLIENT_ORIGIN` to the exact HTTPS URL you published and redeploy. |
| HTTP works but websocket closes instantly | Route not created with websocket support | Edit the URL mapping and ensure the **Websocket** toggle is enabled. |
| Build logs show "pnpm: command not found" | `corepack` failed to run in the base image | Cosmos uses the official `node:20-bookworm` image which ships `corepack`. If you swap images, run `corepack enable` before invoking pnpm. |
| Metrics/health endpoints 404 | Directly hitting the server container | Access them through the published domain (e.g. `https://play.example.com/metrics`) so nginx forwards the request. |

With this setup you can manage the entire Bitby deployment — cloning, builds, environment management, routing, and updates — directly from the Cosmos Cloud dashboard without touching SSH.
