# Bitby on Cosmos Cloud — Docker Compose Deployment Guide

> **Scope.** These instructions explain how to deploy the Bitby mono-repo on [Cosmos Cloud](https://cosmos-cloud.io) using **only the Cosmos dashboard**. No SSH access is required; every step happens in the browser. The final topology keeps the Fastify realtime server private on the internal network while the Vite/React client is the only service exposed to the public internet through Cosmos' reverse proxy.

---

## 1. Prerequisites inside Cosmos

1. **Create / select a project.** Sign in to Cosmos, open the workspace that owns your server, and create a new *Project* (or reuse an existing one) that will host the Bitby stack.
2. **Attach a Git repository.** In the project sidebar choose **Repositories → Add repository** and authorize Cosmos to read the Git provider that hosts this repo. Point Cosmos at the Bitby repository's default branch so Compose builds always pick up the latest code.
3. **Provision secrets.** Navigate to **Project Settings → Secrets** and add the following key/value pairs so they can be injected into the Compose stack later:
   - `BITBY_JWT_SECRET` — a long random string (32+ characters).
   - `BITBY_POSTGRES_PASSWORD` — the password you want Postgres to use (avoid the default `bitby`).
   - Optional: `BITBY_CLIENT_ORIGIN` — the public URL you intend to use (e.g. `https://play.example.com`). You can also set this at deploy time once the domain is known.

---

## 2. Review the Cosmos-ready Compose bundle

The repository ships a Compose file purpose-built for Cosmos along with Dockerfiles that build production images for the server and client:

- `packages/infra/docker/docker-compose.cosmos.yml`
- `packages/infra/docker/server.Dockerfile`
- `packages/infra/docker/client.Dockerfile`
- `packages/infra/docker/nginx.client.conf`

The Compose stack defines four services:

| Service   | Purpose | Network exposure |
|-----------|---------|------------------|
| `postgres` | Bitby's Postgres 15 database with persistent volume `postgres-data`. | Internal only |
| `redis`    | Redis 7 for presence and pub/sub with volume `redis-data`. | Internal only |
| `server`   | Fastify + Socket.IO backend listening on port `3001`. Cosmos only needs the `expose` directive so the container stays private. | Internal only |
| `client`   | Nginx serving the built React client. Nginx also proxies `/auth/*`, `/admin/*`, `/metrics`, `/readyz`, `/healthz`, and `/ws` traffic to the private server container. | Published via Cosmos' HTTP proxy |

The Dockerfiles perform a frozen `pnpm install`, build the shared schemas, compile the TypeScript server, and emit a production Vite bundle for the client. The client image honours two optional build arguments—`VITE_BITBY_WS_URL` and `VITE_BITBY_HTTP_URL`—if you need to hard-code endpoints. For most Cosmos deployments you can leave them empty so the runtime defaults use the same origin that serves the client.

---

## 3. Create the Compose application in Cosmos

1. Inside the project, click **Deployments → New deployment → Docker Compose**.
2. Give the deployment a name such as `bitby-prod`.
3. Under **Repository**, choose the Bitby repo you attached earlier and leave the branch on `main` (or the branch you wish to deploy).
4. When Cosmos asks for the Compose file, browse the repository tree and select `packages/infra/docker/docker-compose.cosmos.yml`.
5. Enable **Auto redeploy on push** if you want Cosmos to rebuild/restart the stack whenever the branch updates.

---

## 4. Wire up environment variables, build args, and volumes

With the Compose preview open:

1. Expand the **Environment variables & secrets** section for the `server` service and add the following entries:
   - `JWT_SECRET` → `{{ secrets.BITBY_JWT_SECRET }}`
   - `PGPASSWORD` → `{{ secrets.BITBY_POSTGRES_PASSWORD }}`
   - `CLIENT_ORIGIN` → either `{{ secrets.BITBY_CLIENT_ORIGIN }}` or leave blank for now.
2. Still under the `server` service, confirm the default values for `PGHOST`, `PGPORT`, `PGDATABASE`, and `PGUSER` match your requirements. They are pre-configured for the internal Postgres container, so most installations can leave them unchanged.
3. For the `client` service, expand **Build arguments** and supply values only if you need to override the defaults:
   - `VITE_BITBY_WS_URL` → leave empty to let the client reuse the public domain for websockets (`wss://<domain>/ws`).
   - `VITE_BITBY_HTTP_URL` → leave empty to let REST requests reuse the public domain (`https://<domain>`).
4. Ensure Cosmos automatically detects the named volumes `postgres-data` and `redis-data`. Leave their defaults so data survives container restarts.
5. Save the configuration.

---

## 5. Publish only the client through Cosmos' proxy

1. After saving, open the deployment's **Networking** tab.
2. Cosmos will list each service with its exposed ports. For `client`, click **Expose HTTP** and choose the desired domain:
   - **Domain:** select one of your managed domains or create a Cosmos-provided subdomain.
   - **Route path:** `/`
   - **Target port:** `80`
   - **TLS:** enable Let’s Encrypt certificates so the site serves over HTTPS.
3. Leave the `server`, `postgres`, and `redis` services unexposed. Because the Compose file only uses `expose`, Cosmos will keep them reachable solely from within the project network. The bundled `nginx.client.conf` forwards `/ws` websocket upgrades and `/auth/*`/`/admin/*` REST calls to the private server container, so the browser never needs a direct connection.

---

## 6. Deploy and verify

1. From the deployment overview page click **Deploy**. Cosmos will build the server and client images using the Dockerfiles referenced in the Compose file.
2. Watch the build logs to ensure both images compile successfully. The server image runs `pnpm --filter @bitby/server build` and the client image runs `pnpm --filter @bitby/client build`; compilation should finish without warnings.
3. Once the containers start, open the **Logs** tab for each service:
   - `postgres` should report readiness.
   - `redis` should log the standard startup banner.
   - `server` should log `Server is listening` on port 3001 and confirm migrations ran.
   - `client` (nginx) should log that it is ready to accept connections on `0.0.0.0:80`.
4. Visit the public domain you configured. The Bitby canvas should render, the blocking “Connecting…” overlay should disappear, and chat plus presence should load from the backend. Because nginx proxies websocket traffic to the private server, no additional firewall rules are required.

---

## 7. Updating the deployment

- **Code changes:** push updates to the tracked branch. If auto-redeploy is enabled, Cosmos will rebuild and roll out the new containers automatically. Otherwise, return to the deployment and click **Deploy** manually.
- **Secrets:** rotate secrets from **Project Settings → Secrets**, then trigger a redeploy so the new values flow into the containers.
- **Database backups:** because Postgres uses a named volume, schedule Cosmos' volume snapshots or export dumps using the Cosmos UI’s “Exec” console for the `postgres` service (no SSH needed).
- **Scaling:** adjust CPU/RAM per service from the deployment’s **Resources** tab. Scale horizontally by adding replicas to the `client` service; keep `server` at a single replica until Redis session affinity is configured for multi-instance realtime.

---

## 8. Troubleshooting tips

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser shows the reconnect overlay indefinitely | `CLIENT_ORIGIN` mismatch blocking CORS or websocket upgrades | Update the `CLIENT_ORIGIN` env var to the final HTTPS domain and redeploy. Ensure the Cosmos route is issuing TLS certificates. |
| Login requests fail with 401 | Seeds are missing | The server runs migrations automatically. If seeds were wiped, open the `postgres` service → **Console** and run `SELECT username FROM app_user;` to confirm the `test` users exist. |
| Static site loads but websocket closes immediately | The Cosmos route is not configured for websockets | In the route details enable websocket support (Cosmos toggles this automatically for HTTP routes, but confirm the option is on). |
| Build fails with "Cannot find pnpm" | Corepack disabled in the build image | Ensure you kept the provided Dockerfiles; they call `corepack enable` before `pnpm install`. |

With these steps, you can manage the entire Bitby deployment—builds, releases, secrets, and networking—directly from Cosmos' web dashboard without ever opening an SSH session.
