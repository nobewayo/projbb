import type { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { decodeToken } from '../auth/jwt.js';
import { extractBearerToken } from '../auth/http.js';
import type { ServerConfig } from '../config.js';
import type { RoomStore } from '../db/rooms.js';
import type { ItemStore } from '../db/items.js';
import type { SocialStore, TradeSessionRecord } from '../db/social.js';
import type { RealtimeServer } from '../ws/connection.js';

interface OccupantRoutesOptions {
  config: ServerConfig;
  roomStore: RoomStore;
  itemStore: ItemStore;
  socialStore: SocialStore;
  realtime: RealtimeServer;
}

const occupantParamsSchema = z.object({
  roomId: z.string().uuid('roomId must be a UUID'),
  occupantId: z.string().uuid('occupantId must be a UUID'),
});

const tradeBodySchema = z
  .object({ context: z.string().min(1).max(120).default('context_menu') })
  .default({ context: 'context_menu' });

const tradeParamsSchema = z.object({
  roomId: z.string().uuid('roomId must be a UUID'),
  tradeId: z.string().uuid('tradeId must be a UUID'),
});

const tradeCancelBodySchema = z
  .object({ reason: z.enum(['cancelled', 'declined']).default('cancelled') })
  .default({ reason: 'cancelled' });

const muteBodySchema = z
  .object({ reason: z.string().min(1).max(512).optional() })
  .default({});

const reportBodySchema = z
  .object({ reason: z.string().min(1).max(512).default('context_menu') })
  .default({ reason: 'context_menu' });

export const occupantRoutes: FastifyPluginCallback<OccupantRoutesOptions> = (
  app,
  options,
  done,
) => {
  const { config, roomStore, itemStore, socialStore, realtime } = options;

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

  const resolveTradeContext = async (
    roomId: string,
    tradeId: string,
    requesterId: string,
  ) => {
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      return { status: 404 as const, message: 'Room not found' };
    }

    const requester = await roomStore.getOccupant(requesterId);
    if (!requester || requester.roomId !== roomId) {
      return { status: 403 as const, message: 'Requester is not present in this room' };
    }

    const trade = await socialStore.getTradeSessionById(tradeId);
    if (!trade || trade.roomId !== roomId) {
      return { status: 404 as const, message: 'Trade session not found in room' };
    }

    if (trade.initiatorId !== requesterId && trade.recipientId !== requesterId) {
      return { status: 403 as const, message: 'Requester is not part of this trade' };
    }

    return { status: 200 as const, room, requester, trade };
  };

  const mapTradeRecord = (trade: TradeSessionRecord) => ({
    id: trade.id,
    initiatorId: trade.initiatorId,
    recipientId: trade.recipientId,
    roomId: trade.roomId,
    status: trade.status,
    createdAt: trade.createdAt.toISOString(),
    acceptedAt: trade.acceptedAt?.toISOString(),
    completedAt: trade.completedAt?.toISOString(),
    cancelledAt: trade.cancelledAt?.toISOString(),
    cancelledBy: trade.cancelledBy ?? undefined,
    cancelledReason: trade.cancelledReason ?? undefined,
  });

  const resolveTradeParticipant = async (params: {
    trade: TradeSessionRecord;
    requesterId: string;
  }) => {
    const { trade, requesterId } = params;
    const otherUserId = trade.initiatorId === requesterId ? trade.recipientId : trade.initiatorId;

    const occupant = await roomStore.getOccupant(otherUserId);
    if (occupant && occupant.username.length > 0) {
      return { id: occupant.id, username: occupant.username };
    }

    const profile = await socialStore.getUserProfile(otherUserId);
    if (profile) {
      return { id: profile.id, username: profile.username };
    }

    return { id: otherUserId, username: 'Unknown occupant' };
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

    await realtime.applyTradeLifecycleUpdate({ trade, actorId: auth.userId });

    await reply.send({
      trade: mapTradeRecord(trade),
      participant: {
        id: context.occupant.id,
        username: context.occupant.username,
      },
    });
  });

  app.post('/rooms/:roomId/trades/:tradeId/accept', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = tradeParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply
        .code(400)
        .send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const { roomId, tradeId } = paramsResult.data;
    const context = await resolveTradeContext(roomId, tradeId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    if (context.trade.status !== 'pending') {
      await reply.code(409).send({ message: 'Trade is not awaiting acceptance' });
      return;
    }

    if (context.trade.recipientId !== auth.userId) {
      await reply.code(403).send({ message: 'Only the invited occupant can accept the trade' });
      return;
    }

    const updated = await socialStore.updateTradeSessionStatus({
      tradeId,
      actorId: auth.userId,
      status: 'accepted',
    });

    if (!updated) {
      await reply.code(409).send({ message: 'Failed to accept trade' });
      return;
    }

    const participant = await resolveTradeParticipant({ trade: updated, requesterId: auth.userId });

    await realtime.applyTradeLifecycleUpdate({ trade: updated, actorId: auth.userId });

    await reply.send({
      trade: mapTradeRecord(updated),
      participant,
    });
  });

  app.post('/rooms/:roomId/trades/:tradeId/cancel', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = tradeParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply
        .code(400)
        .send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = tradeCancelBodySchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      await reply
        .code(400)
        .send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId, tradeId } = paramsResult.data;
    const context = await resolveTradeContext(roomId, tradeId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    if (context.trade.status === 'completed') {
      await reply.code(409).send({ message: 'Completed trades cannot be cancelled' });
      return;
    }

    if (context.trade.status === 'cancelled') {
      await reply.code(409).send({ message: 'Trade has already been cancelled' });
      return;
    }

    const updated = await socialStore.updateTradeSessionStatus({
      tradeId,
      actorId: auth.userId,
      status: 'cancelled',
      reason: bodyResult.data.reason,
    });

    if (!updated) {
      await reply.code(409).send({ message: 'Failed to cancel trade' });
      return;
    }

    const participant = await resolveTradeParticipant({ trade: updated, requesterId: auth.userId });

    await realtime.applyTradeLifecycleUpdate({ trade: updated, actorId: auth.userId });

    await reply.send({
      trade: mapTradeRecord(updated),
      participant,
    });
  });

  app.post('/rooms/:roomId/trades/:tradeId/complete', async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) {
      await reply.code(401).send({ message: 'Authentication required' });
      return;
    }

    const paramsResult = tradeParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply
        .code(400)
        .send({ message: 'Invalid route parameters', issues: paramsResult.error.issues });
      return;
    }

    const { roomId, tradeId } = paramsResult.data;
    const context = await resolveTradeContext(roomId, tradeId, auth.userId);
    if ('message' in context) {
      await reply.code(context.status).send({ message: context.message });
      return;
    }

    if (context.trade.status !== 'accepted') {
      await reply.code(409).send({ message: 'Trade must be active before completion' });
      return;
    }

    const updated = await socialStore.updateTradeSessionStatus({
      tradeId,
      actorId: auth.userId,
      status: 'completed',
    });

    if (!updated) {
      await reply.code(409).send({ message: 'Failed to complete trade' });
      return;
    }

    const participant = await resolveTradeParticipant({ trade: updated, requesterId: auth.userId });

    await realtime.applyTradeLifecycleUpdate({ trade: updated, actorId: auth.userId });

    await reply.send({
      trade: mapTradeRecord(updated),
      participant,
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

    await realtime.applyMuteRecord({ record: mute });

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

    await realtime.applyReportRecord({ record: report });

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
