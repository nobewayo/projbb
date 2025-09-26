import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { decodeToken } from '../auth/jwt.js';
import type { ServerConfig } from '../config.js';
import type { RoomStore } from '../db/rooms.js';
import type { ItemStore } from '../db/items.js';
import type { SocialStore } from '../db/social.js';

interface OccupantRoutesOptions {
  config: ServerConfig;
  roomStore: RoomStore;
  itemStore: ItemStore;
  socialStore: SocialStore;
}

const occupantParamsSchema = z.object({
  roomId: z.string().uuid('roomId must be a UUID'),
  occupantId: z.string().uuid('occupantId must be a UUID'),
});

const tradeBodySchema = z
  .object({ context: z.string().min(1).max(120).default('context_menu') })
  .default({ context: 'context_menu' });

const muteBodySchema = z
  .object({ reason: z.string().min(1).max(512).optional() })
  .default({});

const reportBodySchema = z
  .object({ reason: z.string().min(1).max(512).default('context_menu') })
  .default({ reason: 'context_menu' });

const extractBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token.trim();
};

export const occupantRoutes: FastifyPluginCallback<OccupantRoutesOptions> = (
  app,
  options,
  done,
) => {
  const { config, roomStore, itemStore, socialStore } = options;

  const requireAuth = (request: FastifyRequest): { userId: string } | null => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return null;
    }

    try {
      const user = decodeToken(token, config);
      return { userId: user.id };
    } catch (error) {
      app.log.warn({ err: error }, 'Failed to decode auth token for occupant route');
      return null;
    }
  };

  const resolveOccupantContext = async (
    roomId: string,
    occupantId: string,
    requesterId: string,
  ) => {
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      return { status: 404 as const, message: 'Room not found' };
    }

    const occupant = await roomStore.getOccupant(occupantId);
    if (!occupant || occupant.roomId !== roomId) {
      return { status: 404 as const, message: 'Occupant not found in room' };
    }

    const requester = await roomStore.getOccupant(requesterId);
    if (!requester || requester.roomId !== roomId) {
      return { status: 403 as const, message: 'Requester is not present in this room' };
    }

    return { status: 200 as const, room, occupant, requester };
  };

  app.get('/rooms/:roomId/occupants/:occupantId/profile', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = occupantParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const { roomId, occupantId } = paramsResult.data;
    const context = await resolveOccupantContext(roomId, occupantId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    const profileRecord = await socialStore.getUserProfile(context.occupant.id);
    if (!profileRecord) {
      await reply.code(404).send({ message: 'Profile not found' });
      return;
    }

    const inventory = await itemStore.listInventoryForUser(context.occupant.id);

    await reply.send({
      profile: {
        id: profileRecord.id,
        username: profileRecord.username,
        roles: [...profileRecord.roles],
        createdAt: profileRecord.createdAt.toISOString(),
        inventoryCount: inventory.length,
        position: { ...context.occupant.position },
        room: { id: context.room.id, name: context.room.name },
      },
    });
  });

  app.post('/rooms/:roomId/occupants/:occupantId/trade', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = occupantParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = tradeBodySchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId, occupantId } = paramsResult.data;
    if (occupantId === auth.userId) {
      await reply.code(400).send({ message: 'Cannot initiate a trade with yourself' });
      return;
    }

    const context = await resolveOccupantContext(roomId, occupantId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    if (context.occupant.roles.includes('npc')) {
      await reply.code(400).send({ message: 'Trading is not available for NPCs' });
      return;
    }

    const trade = await socialStore.createTradeSession({
      initiatorId: auth.userId,
      recipientId: occupantId,
      roomId: roomId,
    });

    await reply.send({
      trade: {
        id: trade.id,
        initiatorId: trade.initiatorId,
        recipientId: trade.recipientId,
        roomId: trade.roomId,
        status: trade.status,
        createdAt: trade.createdAt.toISOString(),
      },
      participant: {
        id: context.occupant.id,
        username: context.occupant.username,
      },
    });
  });

  app.post('/rooms/:roomId/occupants/:occupantId/mute', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = occupantParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = muteBodySchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId, occupantId } = paramsResult.data;
    if (occupantId === auth.userId) {
      await reply.code(400).send({ message: 'Cannot mute yourself' });
      return;
    }

    const context = await resolveOccupantContext(roomId, occupantId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    if (context.occupant.roles.includes('npc')) {
      await reply.code(400).send({ message: 'Muting NPCs is not supported' });
      return;
    }

    const mute = await socialStore.recordMute({
      userId: auth.userId,
      mutedUserId: occupantId,
      roomId,
    });

    await reply.send({
      mute: {
        id: mute.id,
        userId: mute.userId,
        mutedUserId: mute.mutedUserId,
        roomId: mute.roomId,
        createdAt: mute.createdAt.toISOString(),
      },
    });
  });

  app.post('/rooms/:roomId/occupants/:occupantId/report', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = occupantParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = reportBodySchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId, occupantId } = paramsResult.data;
    if (occupantId === auth.userId) {
      await reply.code(400).send({ message: 'Cannot report yourself' });
      return;
    }

    const context = await resolveOccupantContext(roomId, occupantId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    const report = await socialStore.recordReport({
      reporterId: auth.userId,
      reportedUserId: occupantId,
      roomId,
      reason: bodyResult.data.reason,
    });

    await reply.send({
      report: {
        id: report.id,
        reporterId: report.reporterId,
        reportedUserId: report.reportedUserId,
        roomId: report.roomId,
        reason: report.reason,
        createdAt: report.createdAt.toISOString(),
      },
    });
  });

  done();
};
