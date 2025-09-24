import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketIOServer } from 'socket.io';
import type { ReadinessController } from './readiness.js';
import type { ServerConfig } from './config.js';
import { handleRealtimeConnection } from './ws/connection.js';
import { authRoutes } from './api/auth.js';
import { resolveCorsOrigins } from './config.js';

const MAX_WS_MESSAGE_BYTES = 64 * 1024;

export interface CreateServerOptions {
  config: ServerConfig;
  readiness: ReadinessController;
}

export const createServer = async ({
  config,
  readiness
}: CreateServerOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
    }
  });

  app.decorate('readiness', readiness);
  const corsOrigins = resolveCorsOrigins(config.CLIENT_ORIGIN);
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true
  });

  await app.register(authRoutes, { config });

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    const controller = app.readiness as ReadinessController;
    if (!controller.isReady()) {
      await reply.code(503).send({ status: 'starting' });
      return;
    }

    return { status: 'ready' };
  });

  const io = new SocketIOServer(app.server, {
    path: '/ws',
    maxHttpBufferSize: MAX_WS_MESSAGE_BYTES,
    transports: ['websocket'],
    cors: {
      origin: corsOrigins,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    handleRealtimeConnection({
      app,
      socket,
      requestId: socket.id,
      config
    });
  });

  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
  });

  return app;
};
