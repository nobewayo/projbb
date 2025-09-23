import Fastify, { type FastifyInstance, type FastifyPluginOptions } from 'fastify';
import websocketPlugin from '@fastify/websocket';
import type { SocketStream } from '@fastify/websocket';
import type { IncomingMessage, OutgoingHttpHeaders } from 'http';
import type { ReadinessController } from './readiness.js';
import type { ServerConfig } from './config.js';

const SUPPORTED_SUBPROTOCOL = 'bitby.v1';
const MAX_WS_MESSAGE_BYTES = 64 * 1024;

const parseProtocols = (header: string | string[] | undefined): string[] => {
  if (!header) {
    return [];
  }

  const values = Array.isArray(header) ? header : [header];
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

type VerifyClientNext = (
  result: boolean,
  code?: number,
  message?: string,
  headers?: OutgoingHttpHeaders
) => void;

const enforceSubprotocol = (request: IncomingMessage, next: VerifyClientNext): void => {
  const protocols = parseProtocols(request.headers['sec-websocket-protocol']);
  if (!protocols.includes(SUPPORTED_SUBPROTOCOL)) {
    next(false, 1002, `WebSocket subprotocol ${SUPPORTED_SUBPROTOCOL} required`);
    return;
  }

  next(true);
};

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

  await app.register(websocketPlugin, {
    options: {
      maxPayload: MAX_WS_MESSAGE_BYTES,
      verifyClient: (
        info: { req: IncomingMessage },
        next: VerifyClientNext
      ): void => enforceSubprotocol(info.req, next),
      handleProtocols: (protocols: string[]): string | false =>
        protocols.includes(SUPPORTED_SUBPROTOCOL) ? SUPPORTED_SUBPROTOCOL : false
    }
  } satisfies FastifyPluginOptions);

  app.decorate('readiness', readiness);

  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (request, reply) => {
    const controller = app.readiness as ReadinessController;
    if (!controller.isReady()) {
      await reply.code(503).send({ status: 'starting' });
      return;
    }

    return { status: 'ready' };
  });

  app.get('/ws', { websocket: true }, (connection: SocketStream) => {
    connection.socket.send(
      JSON.stringify({
        op: 'system:not_ready',
        data: { message: 'Realtime protocol not implemented yet' }
      })
    );
    connection.socket.close(1012, 'Protocol scaffolding pending');
  });

  return app;
};
