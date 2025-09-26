# Bitby Docker Deployment (Debian/Ubuntu)

This guide explains how to run the entire Bitby stack (Postgres, Redis, Fastify API/Socket.IO server, and the production Vite client served by nginx) on a self-managed Debian- or Ubuntu-based host using Docker Compose. The workflow targets fresh Debian 12 "Bookworm" and Ubuntu 22.04 "Jammy" installations with sudo access.

> **Scope.** Everything below happens on a single Linux server that you control (physical, VM, or cloud instance). You will clone the repository, prepare secrets, and launch the containers locally.

---

## 1. Prerequisites

1. **Supported OS:** Debian 12+/Ubuntu 22.04+ with amd64 architecture.
2. **System packages:** `curl`, `git`, `ca-certificates`, `gnupg`, and `lsb-release`.
3. **Docker Engine + Compose plugin:** `docker`, `docker compose` commands available for your user (or run them with `sudo`).
4. **Git access:** SSH key or HTTPS token that can read this repository.

If Docker is not installed yet, follow the commands below (replace `bookworm` with your codename if needed):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
printf "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable\n" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out/in (or `newgrp docker`) so your shell picks up membership in the `docker` group.

---

## 2. Clone the repository

```bash
cd ~/Projects   # choose any workspace directory you prefer
git clone https://github.com/<your-org>/projbb.git
cd projbb
```

All remaining commands run from the repository root unless noted.

---

## 3. Prepare environment configuration

The full-stack Compose bundle reads its secrets and client build URLs from an `.env` file that lives alongside the Compose file. Start by copying the template and editing the values:

```bash
cp packages/infra/docker/.env.example packages/infra/docker/.env
nano packages/infra/docker/.env   # or use your preferred editor
```

Populate at least the following keys:

- `JWT_SECRET`: 32+ random characters. The Fastify server signs short-lived JWTs with this value.
- `POSTGRES_PASSWORD`: Password for the internal Postgres user (`bitby`).
- `CLIENT_ORIGIN`: Public origin used when the server generates absolute URLs (keep `http://localhost` for single-host setups).
- `VITE_BITBY_HTTP_URL` / `VITE_BITBY_WS_URL`: Leave blank to let the client call back to the same origin that serves it through nginx. Override only if you terminate TLS elsewhere and need absolute origins baked into the static bundle.
- `CADDY_DOMAIN` / `CADDY_EMAIL` *(optional)*: Set these when you want the provided Caddy reverse proxy to request Let's Encrypt certificates for a public domain. Leave them blank for local-only deployments.

You can leave the provided defaults (blank client URLs, localhost origin) in place for a single-machine deployment, but revisit them before exposing the stack on the public Internet.

---

## 4. Build and start the stack

From the repository root, launch the Compose bundle:

```bash
cd packages/infra/docker
docker compose -f docker-compose.full.yml --env-file .env build
docker compose -f docker-compose.full.yml --env-file .env up -d
```

This performs the following steps:

1. Builds the Fastify server image (Node.js 20, pnpm workspaces, compiled TypeScript output).
2. Builds the React client, embedding the REST/WebSocket URLs from your `.env` file into the Vite build, and serves it with nginx.
3. Starts Postgres 15 and Redis 7 with persistent volumes.
4. Publishes **only** the nginx-served client on `localhost:8080`. Postgres, Redis, and the Fastify server stay on the private Compose network and are reachable solely by other containers.

The first launch will take several minutes while pnpm installs dependencies and the TypeScript projects compile.

---

## 5. Verify the deployment

1. Check container health:
   ```bash
   docker compose -f docker-compose.full.yml ps
   docker compose -f docker-compose.full.yml logs -f server
   ```
2. Visit [http://localhost:8080](http://localhost:8080) in a browser on the host (or tunnel the port). The deterministic grid, reconnect overlay, and admin chrome should match the current dev build.
3. Exercise the API through the nginx reverse proxy (the server container does not publish its own port):
   ```bash
   curl http://localhost:8080/healthz
   curl http://localhost:8080/readyz
   ```

---

## 6. Publish under your domain with HTTPS

When you're ready to expose Bitby to the public Internet, place the client container behind the bundled Caddy reverse proxy so TLS certificates are issued automatically. The end result keeps Postgres, Redis, and the Fastify server on the private Compose network while Caddy serves HTTPS for your domain.

1. **Create a DNS record.** Add an `A` (and optionally `AAAA`) record for your chosen subdomain (for example, `play.example.com`) pointing at your server's public IP. Wait for the record to propagate before requesting certificates.
2. **Open ports 80/443.** Ensure your cloud firewall / security group permits inbound TCP traffic on ports 80 and 443.
3. **Populate domain settings.** Edit `packages/infra/docker/.env` and set:
   ```ini
   CADDY_DOMAIN=play.example.com
   CADDY_EMAIL=admin@example.com   # used for Let's Encrypt renewal notices
   ```
4. **Copy the Caddyfile template.**
   ```bash
   cd packages/infra/docker
   cp Caddyfile.example Caddyfile
   ```
   The template routes all traffic for `${CADDY_DOMAIN}` to the internal `client:80` service. Adjust only if you need custom headers.
5. **Start the stack with the HTTPS override.** From `packages/infra/docker`, run:
   ```bash
   docker compose -f docker-compose.full.yml -f docker-compose.caddy.yml --env-file .env up -d --build
   ```
   The override removes the public port mapping from the `client` service and introduces a `caddy` container that listens on ports 80/443, requests certificates for `CADDY_DOMAIN`, and reverse proxies requests to `client:80`.
6. **Verify HTTPS.** Visit `https://play.example.com` (replace with your domain). The first request may take a few seconds while Caddy completes the ACME challenge. Subsequent renewals are automatic.

If you ever need to revert to local-only HTTP access, stop the stack, remove `Caddyfile`, clear the `CADDY_*` variables, and start it with just `docker-compose.full.yml` again.

---

## 7. Managing the stack

- Stop the services without removing volumes:
  ```bash
  docker compose -f docker-compose.full.yml down
  ```
- Restart after changing code/config:
  ```bash
  docker compose -f docker-compose.full.yml --env-file .env up -d --build
  ```
- Remove containers **and** volumes (destroys Postgres/Redis data):
  ```bash
  docker compose -f docker-compose.full.yml down -v
  ```
- Connect to internal services when needed:
  ```bash
  docker compose -f docker-compose.full.yml exec postgres psql -U bitby
  docker compose -f docker-compose.full.yml exec redis redis-cli
  ```
  These commands run entirely within the private network, keeping Postgres and Redis inaccessible from the public Internet.

---

## 8. Updating to a new release

1. Pull the latest code:
   ```bash
   cd ~/Projects/projbb
   git fetch origin
   git checkout main
   git pull --ff-only
   ```
2. Rebuild and restart the Compose stack:
   ```bash
   cd packages/infra/docker
   docker compose -f docker-compose.full.yml --env-file .env up -d --build
   ```

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `server` container exits immediately | Missing `JWT_SECRET` or Postgres not reachable | Confirm `.env` values and run `docker compose logs server`. |
| Client shows 404s to `/auth/login` | `VITE_BITBY_HTTP_URL`/`VITE_BITBY_WS_URL` set to an incorrect origin | Clear the values (to fall back to same-origin) or point them at the nginx hostname, then rebuild the client container. |
| Need direct Postgres/Redis access from the host | Ports are intentionally unpublished for security | Use `docker compose exec` as shown above or temporarily add port mappings while debugging, then remove them again. |
| `docker compose` asks for sudo | User not added to `docker` group | Run `sudo usermod -aG docker "$USER"` and relog. |

For additional Linux-focused development instructions (pnpm workflows, manual Postgres/Redis setup, testing), refer to the main [`README.md`](./README.md).
