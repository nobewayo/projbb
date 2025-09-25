import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { adminQuickMenuUpdateSchema, type AdminQuickMenuUpdate } from '@bitby/schemas';
import type { ServerConfig } from '../config.js';
import type { AdminStateStore } from '../db/admin.js';
import { toAdminStatePayload } from '../db/admin.js';
import type { RoomStore } from '../db/rooms.js';
import type { RoomPubSub, RoomAdminEvent } from '../redis/pubsub.js';
import type { RealtimeServer } from '../ws/connection.js';
import { decodeToken } from '../auth/jwt.js';
import type { AuthenticatedUser } from '../auth/types.js';

const paramsSchema = z.object({
  roomId: z.string().uuid('roomId must be a valid UUID'),
});

interface AdminRoutesOptions {
  config: ServerConfig;
  adminStateStore: AdminStateStore;
  roomStore: RoomStore;
  pubsub: RoomPubSub;
  realtime: RealtimeServer;
}

const ensureAuthenticated = async (
  request: FastifyRequest,
  reply: FastifyReply,
  config: ServerConfig,
): Promise<AuthenticatedUser | null> => {
  const header = request.headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    await reply.code(401).send({ message: 'Missing bearer token' });
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    await reply.code(401).send({ message: 'Missing bearer token' });
    return null;
  }

  try {
    return decodeToken(token, config);
  } catch {
    await reply.code(401).send({ message: 'Invalid bearer token' });
    return null;
  }
};

export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (
  app,
  options,
) => {
  const { config, adminStateStore, roomStore, pubsub, realtime } = options;

  app.get('/admin/rooms/:roomId/state', async (request, reply) => {
    const user = await ensureAuthenticated(request, reply, config);
    if (!user) {
      return;
    }

    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      await reply.code(400).send({ message: 'Invalid room identifier' });
      return;
    }

    const room = await roomStore.getRoomById(parsedParams.data.roomId);
    if (!room) {
      await reply.code(404).send({ message: 'Room not found' });
      return;
    }

    const state = await adminStateStore.getRoomState(room.id);
    await reply.send(toAdminStatePayload(state));
  });

  app.patch('/admin/rooms/:roomId/state', async (request, reply) => {
    const user = await ensureAuthenticated(request, reply, config);
    if (!user) {
      return;
    }

    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      await reply.code(400).send({ message: 'Invalid room identifier' });
      return;
    }

    const room = await roomStore.getRoomById(parsedParams.data.roomId);
    if (!room) {
      await reply.code(404).send({ message: 'Room not found' });
      return;
    }

    const parsedBody = adminQuickMenuUpdateSchema.safeParse(request.body);
    if (!parsedBody.success) {
      await reply.code(400).send({
        message: 'Invalid admin state payload',
        issues: parsedBody.error.issues,
      });
      return;
    }

    const update: AdminQuickMenuUpdate = parsedBody.data;

    const updated = await adminStateStore.updateRoomState(room.id, update, {
      updatedBy: user.id,
    });
    realtime.applyAdminStateUpdate(updated);

    const payload = toAdminStatePayload(updated);
    const event: RoomAdminEvent = {
      type: 'admin:state',
      roomId: room.id,
      payload,
    };
    await pubsub.publishAdminState(event);

    await reply.send(payload);
  });
};
