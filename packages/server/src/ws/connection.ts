import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { RawData } from 'ws';
import {
  messageEnvelopeSchema,
  moveRequestDataSchema,
  type MessageEnvelope,
  type MoveErrorCode,
} from '@bitby/schemas';
import { z } from 'zod';
import type { ServerConfig } from '../config.js';
import { decodeToken } from '../auth/jwt.js';
import type {
  AuthenticatedUser,
  RoomSnapshot,
  RoomSnapshotOccupant,
} from '../auth/types.js';

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_GRACE_MS = HEARTBEAT_INTERVAL_MS * 2;
const DEVELOPMENT_ROOM_ID = 'dev-room';
const DEVELOPMENT_ROOM_NAME = 'Development Plaza';

const GRID_ROW_COUNT = 10;
const EVEN_ROW_COLUMNS = 10;
const ODD_ROW_COLUMNS = 11;

const DEVELOPMENT_SPAWN_POINTS: Array<{ x: number; y: number }> = [
  { x: 5, y: 4 },
  { x: 5, y: 5 },
  { x: 4, y: 4 },
  { x: 5, y: 3 },
  { x: 6, y: 5 },
  { x: 4, y: 5 },
  { x: 6, y: 3 },
];

interface TileFlag {
  x: number;
  y: number;
  locked: boolean;
  noPickup: boolean;
}

interface RegisteredConnection {
  stream: SocketStream;
  logger: FastifyBaseLogger;
  userId: string;
}

interface ConnectionContext {
  app: FastifyInstance;
  stream: SocketStream;
  requestId: string;
  config: ServerConfig;
}

type AuthOkPayload = EnvelopeData & {
  user: AuthenticatedUser;
  room: {
    id: string;
    name: string;
  };
  heartbeatIntervalMs: number;
  roomSnapshot: RoomSnapshot;
};

const authPayloadSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

type EnvelopeData = Record<string, unknown>;

type Envelope = MessageEnvelope<EnvelopeData>;

const createTileKey = (x: number, y: number): string => `${x},${y}`;

const initialTileFlags: TileFlag[] = [
  { x: 2, y: 8, locked: false, noPickup: true },
  { x: 7, y: 3, locked: true, noPickup: false },
];

const developmentRoomState: {
  id: string;
  name: string;
  roomSeq: number;
  tiles: TileFlag[];
  tileIndex: Map<string, TileFlag>;
  occupants: Map<string, RoomSnapshotOccupant>;
  connections: Map<SocketStream['socket'], RegisteredConnection>;
} = {
  id: DEVELOPMENT_ROOM_ID,
  name: DEVELOPMENT_ROOM_NAME,
  roomSeq: 1,
  tiles: initialTileFlags,
  tileIndex: new Map(initialTileFlags.map((tile) => [createTileKey(tile.x, tile.y), tile])),
  occupants: new Map<string, RoomSnapshotOccupant>([
    [
      'npc-guide',
      {
        id: 'npc-guide',
        username: 'Guide Bot',
        roles: ['npc'],
        position: { x: 6, y: 4 },
      },
    ],
  ]),
  connections: new Map(),
};

const getColumnsForRow = (row: number): number =>
  row % 2 === 0 ? EVEN_ROW_COLUMNS : ODD_ROW_COLUMNS;

const isTileInBounds = (x: number, y: number): boolean => {
  if (y < 0 || y >= GRID_ROW_COUNT || x < 0) {
    return false;
  }

  const columns = getColumnsForRow(y);
  return x < columns;
};

const isTileLocked = (x: number, y: number): boolean =>
  developmentRoomState.tileIndex.get(createTileKey(x, y))?.locked ?? false;

const isTileOccupied = (x: number, y: number): boolean => {
  for (const occupant of developmentRoomState.occupants.values()) {
    if (occupant.position.x === x && occupant.position.y === y) {
      return true;
    }
  }

  return false;
};

const findAvailableSpawn = (): { x: number; y: number } => {
  for (const candidate of DEVELOPMENT_SPAWN_POINTS) {
    if (isTileLocked(candidate.x, candidate.y)) {
      continue;
    }

    if (!isTileOccupied(candidate.x, candidate.y)) {
      return { ...candidate };
    }
  }

  return { x: 5, y: 4 };
};

const cloneOccupant = (occupant: RoomSnapshotOccupant): RoomSnapshotOccupant => ({
  id: occupant.id,
  username: occupant.username,
  roles: [...occupant.roles],
  position: { x: occupant.position.x, y: occupant.position.y },
});

const ensureOccupantForUser = (user: AuthenticatedUser): RoomSnapshotOccupant => {
  const existing = developmentRoomState.occupants.get(user.id);
  if (existing) {
    existing.username = user.username;
    existing.roles = [...user.roles];
    return existing;
  }

  const spawn = findAvailableSpawn();
  const occupant: RoomSnapshotOccupant = {
    id: user.id,
    username: user.username,
    roles: [...user.roles],
    position: { x: spawn.x, y: spawn.y },
  };

  developmentRoomState.occupants.set(user.id, occupant);
  return occupant;
};

const buildDevelopmentRoomSnapshot = (): RoomSnapshot => {
  const occupants = Array.from(developmentRoomState.occupants.values())
    .map((occupant) => cloneOccupant(occupant))
    .sort((a, b) => {
      if (a.position.y === b.position.y) {
        return a.position.x - b.position.x;
      }

      return a.position.y - b.position.y;
    });

  return {
    id: developmentRoomState.id,
    name: developmentRoomState.name,
    roomSeq: developmentRoomState.roomSeq,
    occupants,
    tiles: developmentRoomState.tiles.map((tile) => ({ ...tile })),
  };
};

const registerRealtimeConnection = (
  logger: FastifyBaseLogger,
  stream: SocketStream,
  user: AuthenticatedUser,
): RoomSnapshot => {
  ensureOccupantForUser(user);
  developmentRoomState.connections.set(stream.socket, { stream, logger, userId: user.id });
  return buildDevelopmentRoomSnapshot();
};

const unregisterRealtimeConnection = (stream: SocketStream): void => {
  developmentRoomState.connections.delete(stream.socket);
};

const broadcastOccupantUpdate = (
  occupant: RoomSnapshotOccupant,
  roomSeq: number,
  excludeSocket?: SocketStream['socket'],
): void => {
  for (const connection of developmentRoomState.connections.values()) {
    if (excludeSocket && connection.stream.socket === excludeSocket) {
      continue;
    }

    safeSend(
      connection.logger,
      connection.stream,
      createEnvelope('room:occupant_moved', 0, {
        occupant: cloneOccupant(occupant),
        roomSeq,
      }),
    );
  }
};

type MoveResult =
  | {
      ok: true;
      occupant: RoomSnapshotOccupant;
      roomSeq: number;
      broadcast: boolean;
    }
  | {
      ok: false;
      code: MoveErrorCode;
      message: string;
      current: { x: number; y: number };
      roomSeq: number;
    };

const attemptMove = (
  userId: string,
  target: { x: number; y: number },
): MoveResult => {
  const occupant = developmentRoomState.occupants.get(userId);
  if (!occupant) {
    return {
      ok: false,
      code: 'not_in_room',
      message: 'User is not registered in the development room',
      current: { x: 0, y: 0 },
      roomSeq: developmentRoomState.roomSeq,
    };
  }

  const currentPosition = { ...occupant.position };

  if (!isTileInBounds(target.x, target.y)) {
    return {
      ok: false,
      code: 'invalid_tile',
      message: 'Target tile is outside the playable field',
      current: currentPosition,
      roomSeq: developmentRoomState.roomSeq,
    };
  }

  if (isTileLocked(target.x, target.y)) {
    return {
      ok: false,
      code: 'locked_tile',
      message: 'Target tile is locked',
      current: currentPosition,
      roomSeq: developmentRoomState.roomSeq,
    };
  }

  const alreadyAtTarget =
    currentPosition.x === target.x && currentPosition.y === target.y;

  if (alreadyAtTarget) {
    return {
      ok: true,
      occupant: cloneOccupant(occupant),
      roomSeq: developmentRoomState.roomSeq,
      broadcast: false,
    };
  }

  occupant.position = { x: target.x, y: target.y };
  developmentRoomState.roomSeq += 1;

  return {
    ok: true,
    occupant: cloneOccupant(occupant),
    roomSeq: developmentRoomState.roomSeq,
    broadcast: true,
  };
};

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
  config: ServerConfig,
  closeWithReason: (code: number, reason: string) => void,
): AuthenticatedUser | null => {
  const parsed = authPayloadSchema.safeParse(envelope.data);
  if (!parsed.success) {
    acknowledge(logger, stream, envelope, 'error:auth_invalid', {
      message: 'Invalid auth payload',
      issues: parsed.error.issues,
    });
    return null;
  }

  let authenticatedUser: AuthenticatedUser;
  try {
    authenticatedUser = decodeToken(parsed.data.token, config);
  } catch (error) {
    logger.warn({ err: error }, 'Rejected realtime auth token');
    acknowledge(logger, stream, envelope, 'error:auth_invalid', {
      message: 'Authentication failed: invalid token',
    });
    closeWithReason(4003, 'Invalid auth token');
    return null;
  }

  const snapshot = registerRealtimeConnection(logger, stream, authenticatedUser);
  const payload: AuthOkPayload = {
    user: authenticatedUser,
    room: {
      id: snapshot.id,
      name: snapshot.name,
    },
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    roomSnapshot: snapshot,
  };

  acknowledge(logger, stream, envelope, 'auth:ok', payload);

  emitSystemMessage(logger, stream, 'system:room_snapshot', {
    message:
      'Authoritative snapshot streaming is stubbed; using development fixtures.',
    roomSeq: snapshot.roomSeq,
    occupants: snapshot.occupants,
  });

  const occupantForUser = snapshot.occupants.find(
    (occupant) => occupant.id === authenticatedUser.id,
  );

  if (occupantForUser) {
    broadcastOccupantUpdate(occupantForUser, snapshot.roomSeq, stream.socket);
  }

  return authenticatedUser;
};

export const handleRealtimeConnection = ({
  app,
  stream,
  requestId,
  config,
}: ConnectionContext): void => {
  const logger = app.log.child({ scope: 'ws', requestId });
  let isAuthenticated = false;
  let sessionUser: AuthenticatedUser | null = null;
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

        const user = handleAuth(logger, stream, envelope, config, closeWithReason);
        if (user) {
          isAuthenticated = true;
          sessionUser = user;
          lastHeartbeatAt = Date.now();
          logger.info({ userId: user.id }, 'Client authenticated');
        }
        return;
      }
      case 'move': {
        if (!isAuthenticated || !sessionUser) {
          acknowledge(logger, stream, envelope, 'error:not_authenticated', {
            message: 'Authenticate before issuing realtime operations',
          });
          return;
        }

        const payloadResult = moveRequestDataSchema.safeParse(envelope.data);
        if (!payloadResult.success) {
          acknowledge(logger, stream, envelope, 'error:move_payload', {
            message: 'Invalid move payload',
            issues: payloadResult.error.issues,
          });
          return;
        }

        const target = payloadResult.data;
        const moveResult = attemptMove(sessionUser.id, target);

        if (moveResult.ok) {
          acknowledge(logger, stream, envelope, 'move:ok', {
            x: moveResult.occupant.position.x,
            y: moveResult.occupant.position.y,
            roomSeq: moveResult.roomSeq,
          });
          if (moveResult.broadcast) {
            broadcastOccupantUpdate(moveResult.occupant, moveResult.roomSeq);
          }
          logger.info(
            {
              userId: sessionUser.id,
              x: moveResult.occupant.position.x,
              y: moveResult.occupant.position.y,
              roomSeq: moveResult.roomSeq,
            },
            'Processed move operation',
          );
        } else {
          acknowledge(logger, stream, envelope, 'move:err', {
            code: moveResult.code,
            message: moveResult.message,
            at: target,
            current: moveResult.current,
            roomSeq: moveResult.roomSeq,
          });
          logger.warn(
            {
              userId: sessionUser.id,
              target,
              code: moveResult.code,
            },
            'Rejected move operation',
          );
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
    unregisterRealtimeConnection(stream);
    logger.info(
      { code, reason: reason.toString(), userId: sessionUser?.id ?? null },
      'WebSocket connection closed',
    );
  });

  stream.socket.on('error', (error: Error) => {
    logger.error({ err: error }, 'WebSocket error');
  });

  emitSystemMessage(logger, stream, 'system:hello', {
    message: 'Authenticate via { op: "auth" } to start streaming realtime state.',
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  });
};
