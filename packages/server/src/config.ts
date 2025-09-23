import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return 3001;
    }

    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      return Number.parseInt(value, 10);
    }

    throw new Error("PORT must be a number or numeric string");
  }, z.number().int().min(1).max(65535)),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info")
});

export type ServerConfig = z.infer<typeof configSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const parsed = configSchema.parse({
    NODE_ENV: env.NODE_ENV,
    HOST: env.HOST,
    PORT: env.PORT,
    LOG_LEVEL: env.LOG_LEVEL
  });

  return parsed;
};
