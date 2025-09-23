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
  CLIENT_ORIGIN: z.string().default("http://localhost:5173")
});

export type ServerConfig = z.infer<typeof configSchema>;

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
    CLIENT_ORIGIN: env.CLIENT_ORIGIN
  });

  return parsed;
};
