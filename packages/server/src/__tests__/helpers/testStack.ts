import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

const parseInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

interface DatabaseCredentials {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface TestStackConfig {
  pg: DatabaseCredentials;
  redisUrl: string;
}

export interface TestStack {
  config: TestStackConfig;
  flush(): Promise<void>;
  stop(): Promise<void>;
}

const buildRedisFlusher = (redisUrl: string) => async (): Promise<void> => {
  const client = new Redis(redisUrl);
  try {
    await client.flushall();
  } finally {
    client.disconnect();
  }
};

const attemptExternalStack = async (): Promise<TestStack | null> => {
  const pgHost = process.env.BITBY_TEST_PGHOST ?? process.env.PGHOST ?? '127.0.0.1';
  const pgPort = parseInteger(
    process.env.BITBY_TEST_PGPORT ?? process.env.PGPORT,
    5432,
  );
  const pgDatabase =
    process.env.BITBY_TEST_PGDATABASE ?? process.env.PGDATABASE ?? 'bitby';
  const pgUser = process.env.BITBY_TEST_PGUSER ?? process.env.PGUSER ?? 'bitby';
  const pgPassword =
    process.env.BITBY_TEST_PGPASSWORD ?? process.env.PGPASSWORD ?? 'bitby';
  const redisUrl =
    process.env.BITBY_TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

  const probePool = new Pool({
    host: pgHost,
    port: pgPort,
    database: pgDatabase,
    user: pgUser,
    password: pgPassword,
  });

  try {
    await probePool.query('SELECT 1');
  } catch (error) {
    await probePool.end();
    return null;
  }

  await probePool.end();

  const probeRedis = new Redis(redisUrl);
  try {
    await probeRedis.ping();
  } catch (error) {
    probeRedis.disconnect();
    return null;
  }

  probeRedis.disconnect();

  const credentials: DatabaseCredentials = {
    host: pgHost,
    port: pgPort,
    database: pgDatabase,
    user: pgUser,
    password: pgPassword,
  };

  return {
    config: {
      pg: credentials,
      redisUrl,
    },
    flush: buildRedisFlusher(redisUrl),
    stop: async () => {},
  };
};

const POSTGRES_IMAGE = 'postgres:16-alpine';
const REDIS_IMAGE = 'redis:7-alpine';

const startContainerStack = async (): Promise<TestStack> => {
  const postgres: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('bitby')
    .withUsername('bitby')
    .withPassword('bitby')
    .start();

  const redis: StartedRedisContainer = await new RedisContainer(REDIS_IMAGE)
    .start();

  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  return {
    config: {
      pg: {
        host: postgres.getHost(),
        port: postgres.getPort(),
        database: postgres.getDatabase(),
        user: postgres.getUsername(),
        password: postgres.getPassword(),
      },
      redisUrl,
    },
    flush: buildRedisFlusher(redisUrl),
    stop: async () => {
      await Promise.all([postgres.stop(), redis.stop()]);
    },
  };
};

export const startTestStack = async (): Promise<TestStack> => {
  const preference = process.env.BITBY_TEST_STACK?.toLowerCase();

  if (preference === 'external') {
    const external = await attemptExternalStack();
    if (!external) {
      throw new Error(
        'BITBY_TEST_STACK=external but no reachable Postgres/Redis were found',
      );
    }
    return external;
  }

  try {
    return await startContainerStack();
  } catch (containerError) {
    if (preference === 'containers') {
      throw containerError;
    }

    const external = await attemptExternalStack();
    if (external) {
      return external;
    }

    throw containerError;
  }
};
