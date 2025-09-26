# Bitby

Bitby is a realtime social world built on a deterministic isometric grid served by Fastify and rendered with React.
The pnpm workspace includes shared schemas so the client and server validate the same Socket.IO envelopes and REST payloads.
Install dependencies with `pnpm install`, then start Postgres and Redis via Docker or local services before running workspace scripts.
Launch the API with `pnpm --filter @bitby/server dev` and the client with `pnpm --filter @bitby/client dev`.
Run `BITBY_TEST_STACK=containers pnpm test` for the default Vitest suites or switch to `BITBY_TEST_STACK=external` if you manage the databases yourself.
Review [AGENT.md](./AGENT.md) for the full spec, build notes, CI requirements, and change log.
