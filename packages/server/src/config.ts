import { z } from 'zod';

const numericEnv = (value: unknown, defaultValue: number): number => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`Expected numeric string but received ${value}`);
    }

    return parsed;
  }

  throw new Error(`Unsupported numeric env value: ${String(value)}`);
};

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z
    .preprocess((value) => numericEnv(value, 3001), z.number().int().min(1).max(65535)),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  JWT_SECRET: z
    .string()
    .min(1, "JWT_SECRET is required")
    .default("development-insecure-secret"),
  JWT_ISSUER: z.string().default("bitby"),
  JWT_AUDIENCE: z.string().default("bitby.client"),
  TOKEN_TTL_SECONDS: z
    .preprocess((value) => numericEnv(value, 3600), z.number().int().min(60))
    .default(3600),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  PGHOST: z.string().default("127.0.0.1"),
  PGPORT: z
    .preprocess((value) => numericEnv(value, 5432), z.number().int().min(1).max(65535))
    .default(5432),
  PGDATABASE: z.string().default("bitby"),
  PGUSER: z.string().default("bitby"),
  PGPASSWORD: z.string().default("bitby"),
  PG_POOL_MIN: z
    .preprocess((value) => numericEnv(value, 0), z.number().int().min(0))
    .default(0),
  PG_POOL_MAX: z
    .preprocess((value) => numericEnv(value, 10), z.number().int().min(1))
    .default(10),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
});

export type ServerConfig = z.infer<typeof configSchema>;

const buildOrigin = (protocol: string, hostname: string, port: string): string => {
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}//${hostname}${portSuffix}`;
};

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

export const resolveCorsOrigins = (origin: string): string | string[] => {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch (error) {
    return origin;
  }

  if (!LOCALHOST_HOSTNAMES.has(parsed.hostname)) {
    return parsed.origin;
  }

  const variants: string[] = [];
  const addVariant = (value: string): void => {
    if (!variants.includes(value)) {
      variants.push(value);
    }
  };

  addVariant(parsed.origin);
  for (const hostname of LOCALHOST_HOSTNAMES) {
    addVariant(buildOrigin(parsed.protocol, hostname, parsed.port));
  }

  return variants;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const parsed = configSchema.parse({
    NODE_ENV: env.NODE_ENV,
    HOST: env.HOST,
    PORT: env.PORT,
    LOG_LEVEL: env.LOG_LEVEL,
    JWT_SECRET: env.JWT_SECRET,
    JWT_ISSUER: env.JWT_ISSUER,
    JWT_AUDIENCE: env.JWT_AUDIENCE,
    TOKEN_TTL_SECONDS: env.TOKEN_TTL_SECONDS,
    CLIENT_ORIGIN: env.CLIENT_ORIGIN,
    PGHOST: env.PGHOST,
    PGPORT: env.PGPORT,
    PGDATABASE: env.PGDATABASE,
    PGUSER: env.PGUSER,
    PGPASSWORD: env.PGPASSWORD,
    PG_POOL_MIN: env.PG_POOL_MIN,
    PG_POOL_MAX: env.PG_POOL_MAX,
    REDIS_URL: env.REDIS_URL,
  });

  return parsed;
};
