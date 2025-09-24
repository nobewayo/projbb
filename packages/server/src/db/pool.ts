import { Pool } from 'pg';
import type { ServerConfig } from '../config.js';

export const createPgPool = (config: ServerConfig): Pool =>
  new Pool({
    host: config.PGHOST,
    port: config.PGPORT,
    database: config.PGDATABASE,
    user: config.PGUSER,
    password: config.PGPASSWORD,
    min: config.PG_POOL_MIN,
    max: config.PG_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

export type DatabasePool = ReturnType<typeof createPgPool>;
