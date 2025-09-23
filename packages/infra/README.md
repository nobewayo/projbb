# Infra Package (Planned)

This package consolidates infrastructure tooling (Docker Compose, deployment manifests, config schemas) that support local development and CI/CD workflows described in Master Spec v3.7 §§17–18, 21. The initial compose stack boots Postgres + Redis with the memory and persistence defaults required for authoritative room state experiments.

## Docker Compose

```bash
cd packages/infra/docker
docker compose up -d     # start Postgres (5432) and Redis (6379)
docker compose down      # stop services (retain volumes)
docker compose down -v   # destroy services + volumes
```

Credentials are `bitby/bitby` for Postgres with a default `bitby` database. Redis exposes the default database with the `volatile-lru` eviction policy, matching the spec.

## Upcoming Tasks
- Add API, WebSocket, and client services to the compose stack for full-stack smoke tests.
- Provide seed scripts and volume management for reproducible local environments.
- Document environment variable management and config hot-reload workflows.
- Prepare CI helper scripts for smoke tests and health check verification.
