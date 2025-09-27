# Bitby

Bitby is a realtime social world built on a deterministic isometric grid served by Fastify and rendered with React.
The pnpm workspace includes shared schemas so the client and server validate the same Socket.IO envelopes and REST payloads.

## Getting Started

1. Install dependencies with `pnpm install`.
2. Start Postgres and Redis via Docker or your preferred local services before running workspace scripts.
3. Launch the API with `pnpm --filter @bitby/server dev`.
4. Launch the client with `pnpm --filter @bitby/client dev`.
5. Run `BITBY_TEST_STACK=containers pnpm test` for the default Vitest suites or switch to `BITBY_TEST_STACK=external` if you manage the databases yourself.
6. Review [AGENT.md](./AGENT.md) for the full spec, build notes, CI requirements, and change log.
