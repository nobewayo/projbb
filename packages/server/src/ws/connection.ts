import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { RawData } from 'ws';
import { messageEnvelopeSchema, type MessageEnvelope } from '@bitby/schemas';
import { z } from 'zod';

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_GRACE_MS = HEARTBEAT_INTERVAL_MS * 2;

interface ConnectionContext {
  app: FastifyInstance;
  stream: SocketStream;
  requestId: string;
}

type AuthOkPayload = EnvelopeData & {
  user: {
    id: string;
    username: string;
    roles: string[];
  };
  room: {
    id: string;
    name: string;
  };
  heartbeatIntervalMs: number;
};

const authPayloadSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

type EnvelopeData = Record<string, unknown>;

type Envelope = MessageEnvelope<EnvelopeData>;

const toUnixTimestamp = () => Math.floor(Date.now() / 1000);

const createEnvelope = (
  op: string,
  seq: number,
  data: EnvelopeData = {},
): Envelope => ({
  op,
  seq,
  ts: toUnixTimestamp(),
  data,
});

const safeSend = (
  logger: FastifyBaseLogger,
  stream: SocketStream,
  envelope: Envelope,
): void => {
  try {
    stream.socket.send(JSON.stringify(envelope));
  } catch (error) {
    logger.error({ err: error }, 'Failed to send websocket envelope');
  }
};

const acknowledge = (
  logger: FastifyBaseLogger,
  stream: SocketStream,
  requestEnvelope: Envelope,
  op: string,
  data: EnvelopeData = {},
): void => {
  safeSend(logger, stream, createEnvelope(op, requestEnvelope.seq, data));
};

const emitSystemMessage = (
  logger: FastifyBaseLogger,
  stream: SocketStream,
  op: string,
  data: EnvelopeData,
): void => {
  safeSend(logger, stream, createEnvelope(op, 0, data));
};

const handleAuth = (
  logger: FastifyBaseLogger,
  stream: SocketStream,
  envelope: Envelope,
): AuthOkPayload | null => {
  const parsed = authPayloadSchema.safeParse(envelope.data);
  if (!parsed.success) {
    acknowledge(logger, stream, envelope, 'error:auth_invalid', {
      message: 'Invalid auth payload',
      issues: parsed.error.issues,
    });
    return null;
  }

  const payload: AuthOkPayload = {
    user: {
      id: 'dev-user',
      username: 'Development User',
      roles: ['user'],
    },
    room: {
      id: 'dev-room',
      name: 'Development Plaza',
    },
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  };

  acknowledge(logger, stream, envelope, 'auth:ok', payload);

  emitSystemMessage(logger, stream, 'system:room_snapshot', {
    message: 'Realtime room snapshot will stream from the authority server in future iterations.',
  });

  return payload;
};

export const handleRealtimeConnection = ({
  app,
  stream,
  requestId,
}: ConnectionContext): void => {
  const logger = app.log.child({ scope: 'ws', requestId });
  let isAuthenticated = false;
  let lastHeartbeatAt = Date.now();

  const closeWithReason = (code: number, reason: string): void => {
    try {
      stream.socket.close(code, reason);
    } catch (error) {
      logger.error({ err: error }, 'Failed to close websocket connection gracefully');
    }
  };

  const heartbeatMonitor = setInterval(() => {
    const elapsed = Date.now() - lastHeartbeatAt;
    if (elapsed > HEARTBEAT_GRACE_MS) {
      logger.warn({ elapsed }, 'Heartbeat window elapsed; closing connection');
      closeWithReason(1013, 'Heartbeat timeout');
    }
  }, HEARTBEAT_INTERVAL_MS);

  stream.socket.on('message', (raw: RawData) => {
    let data: string;
    if (typeof raw === 'string') {
      data = raw;
    } else if (Buffer.isBuffer(raw)) {
      data = raw.toString('utf8');
    } else if (Array.isArray(raw)) {
      data = Buffer.concat(raw).toString('utf8');
    } else {
      data = Buffer.from(raw).toString('utf8');
    }
    let parsed: unknown;

    try {
      parsed = JSON.parse(data);
    } catch (error) {
      logger.warn({ err: error }, 'Received invalid JSON payload');
      safeSend(logger, stream, createEnvelope('error:invalid_json', 0, {
        message: 'Messages must be valid JSON',
      }));
      closeWithReason(1003, 'Invalid JSON payload');
      return;
    }

    const envelopeResult = messageEnvelopeSchema.safeParse(parsed);
    if (!envelopeResult.success) {
      logger.warn({ issues: envelopeResult.error.issues }, 'Received malformed envelope');
      safeSend(logger, stream, createEnvelope('error:envelope', 0, {
        message: 'Malformed envelope',
        issues: envelopeResult.error.issues,
      }));
      return;
    }

    const envelope = envelopeResult.data;
    lastHeartbeatAt = Date.now();

    switch (envelope.op) {
      case 'ping': {
        acknowledge(logger, stream, envelope, 'pong', {
          serverTs: toUnixTimestamp(),
        });
        return;
      }
      case 'auth': {
        if (isAuthenticated) {
          acknowledge(logger, stream, envelope, 'error:auth_state', {
            message: 'Auth already completed for this session',
          });
          return;
        }

        const result = handleAuth(logger, stream, envelope);
        if (result) {
          isAuthenticated = true;
          logger.info({ userId: result.user.id }, 'Client authenticated');
        }
        return;
      }
      default: {
        if (!isAuthenticated) {
          acknowledge(logger, stream, envelope, 'error:not_authenticated', {
            message: 'Authenticate before issuing realtime operations',
          });
          return;
        }

        acknowledge(logger, stream, envelope, 'error:unhandled_op', {
          message: `Operation ${envelope.op} is not yet implemented`,
        });
      }
    }
  });

  stream.socket.on('close', (code: number, reason: Buffer) => {
    clearInterval(heartbeatMonitor);
    logger.info({ code, reason: reason.toString() }, 'WebSocket connection closed');
  });

  stream.socket.on('error', (error: Error) => {
    logger.error({ err: error }, 'WebSocket error');
  });

  emitSystemMessage(logger, stream, 'system:hello', {
    message: 'Authenticate via { op: "auth" } to start streaming realtime state.',
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  });

};
