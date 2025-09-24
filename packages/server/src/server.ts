import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import type { ReadinessController } from './readiness.js';
import type { ServerConfig } from './config.js';
import { authRoutes } from './api/auth.js';
import { resolveCorsOrigins } from './config.js';
import { createPgPool } from './db/pool.js';
import { runMigrations } from './db/migrations.js';
import { createUserStore } from './auth/store.js';
import { createRoomStore } from './db/rooms.js';
import { createChatStore } from './db/chat.js';
import { createRoomPubSub } from './redis/pubsub.js';
import { createMetricsBundle } from './metrics/registry.js';
import { createRealtimeServer } from './ws/connection.js';

const MAX_WS_MESSAGE_BYTES = 64 * 1024;

export interface CreateServerOptions {
  config: ServerConfig;
  readiness: ReadinessController;
}

export const createServer = async ({
  config,
  readiness,
}: CreateServerOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  const pool = createPgPool(config);
  await runMigrations(pool);

  const userStore = createUserStore(pool);
  const roomStore = createRoomStore(pool);
  const chatStore = createChatStore(pool);
  const metrics = createMetricsBundle();
  const instanceId = randomUUID();
  const pubsub = await createRoomPubSub({
    config,
    logger: app.log.child({ scope: 'redis', instanceId }),
    instanceId,
  });
  const realtime = await createRealtimeServer({
    config,
    roomStore,
    chatStore,
    pubsub,
    metrics,
  });

  app.decorate('readiness', readiness);
  const corsOrigins = resolveCorsOrigins(config.CLIENT_ORIGIN);
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(authRoutes, { config, userStore });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    const controller = app.readiness as ReadinessController;
    if (!controller.isReady()) {
      await reply.code(503).send({ status: 'starting' });
      return;
    }

    return { status: 'ready' };
  });

  app.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', metrics.registry.contentType);
    return reply.send(await metrics.registry.metrics());
  });

  const io = new SocketIOServer(app.server, {
    path: '/ws',
    maxHttpBufferSize: MAX_WS_MESSAGE_BYTES,
    transports: ['websocket'],
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    realtime.handleConnection({
      app,
      socket,
      requestId: socket.id,
    });
  });

  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    await realtime.shutdown();
    await pubsub.close();
    await pool.end();
  });

  return app;
};
