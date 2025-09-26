import { randomUUID } from 'node:crypto';
import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import type { RoomStore } from '../db/rooms.js';
import type { AdminStateStore } from '../db/admin.js';
import type { RealtimeServer } from '../ws/connection.js';
import type { ItemStore } from '../db/items.js';

interface AdminRoutesOptions {
  roomStore: RoomStore;
  adminStateStore: AdminStateStore;
  realtime: RealtimeServer;
  itemStore: ItemStore;
}

const tileParamsSchema = z.object({
  roomId: z.string().uuid('roomId must be a UUID'),
  x: z.coerce.number().int(),
  y: z.coerce.number().int(),
});

const tileLockBodySchema = z.object({
  locked: z.boolean(),
  updatedBy: z.string().min(1).default('admin'),
});

const tilePickupBodySchema = z.object({
  noPickup: z.boolean(),
  updatedBy: z.string().min(1).default('admin'),
});

const affordanceBodySchema = z.object({
  gridVisible: z.boolean(),
  showHoverWhenGridHidden: z.boolean(),
  moveAnimationsEnabled: z.boolean(),
  updatedBy: z.string().min(1).default('admin'),
});

const latencyTraceBodySchema = z
  .object({
    requestedBy: z.string().uuid('requestedBy must be a UUID').optional(),
  })
  .default({});

const plantSpawnBodySchema = z.object({
  tileX: z.coerce.number().int().min(0, 'tileX must be non-negative'),
  tileY: z.coerce.number().int().min(0, 'tileY must be non-negative'),
  updatedBy: z.string().min(1).default('admin'),
});

const GRID_ROW_COUNT = 10;
const EVEN_ROW_COLUMNS = 10;
const ODD_ROW_COLUMNS = 11;

const PLANT_TEMPLATE = {
  name: 'Atrium Plant',
  description:
    'Lush greenery staged near the spawn tiles to verify z-ordering beneath avatars while ensuring pickup gating still works.',
  textureKey: 'plant',
} as const;

const isTileInBounds = (x: number, y: number): boolean => {
  if (y < 0 || y >= GRID_ROW_COUNT || x < 0) {
    return false;
  }

  const columns = y % 2 === 0 ? EVEN_ROW_COLUMNS : ODD_ROW_COLUMNS;
  return x < columns;
};

export const adminRoutes: FastifyPluginCallback<AdminRoutesOptions> = (
  app,
  options,
  done,
) => {
  const { roomStore, adminStateStore, realtime, itemStore } = options;

  app.post('/admin/rooms/:roomId/tiles/:x/:y/lock', async (request, reply) => {
    const paramsResult = tileParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid tile parameters', issues: paramsResult.error.issues });
      return;
    }
    const bodyResult = tileLockBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId, x, y } = paramsResult.data;
    const { locked, updatedBy } = bodyResult.data;
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      await reply.code(404).send({ message: 'Room not found' });
      return;
    }

    const tile = await roomStore.updateTileFlag(roomId, x, y, { locked });
    const roomSeq = await roomStore.incrementRoomSequence(roomId);
    await realtime.applyTileFlagUpdate({ tile, roomSeq, updatedBy });

    await reply.send({ tile: { ...tile, roomSeq } });
  });

  app.post('/admin/rooms/:roomId/tiles/:x/:y/no-pickup', async (request, reply) => {
    const paramsResult = tileParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid tile parameters', issues: paramsResult.error.issues });
      return;
    }
    const bodyResult = tilePickupBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId, x, y } = paramsResult.data;
    const { noPickup, updatedBy } = bodyResult.data;
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      await reply.code(404).send({ message: 'Room not found' });
      return;
    }

    const tile = await roomStore.updateTileFlag(roomId, x, y, { noPickup });
    const roomSeq = await roomStore.incrementRoomSequence(roomId);
    await realtime.applyTileFlagUpdate({ tile, roomSeq, updatedBy });

    await reply.send({ tile: { ...tile, roomSeq } });
  });

  app.post('/admin/rooms/:roomId/dev-affordances', async (request, reply) => {
    const paramsResult = tileParamsSchema.pick({ roomId: true }).safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid room parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = affordanceBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId } = paramsResult.data;
    const { updatedBy, ...affordances } = bodyResult.data;

    const state = await adminStateStore.updateAffordances(roomId, affordances);
    await realtime.applyAffordanceUpdate({ state: state.affordances, updatedBy });

    await reply.send({ state: state.affordances });
  });

  app.post('/admin/rooms/:roomId/latency-trace', async (request, reply) => {
    const paramsResult = tileParamsSchema.pick({ roomId: true }).safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid room parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = latencyTraceBodySchema.safeParse(request.body ?? {});
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId } = paramsResult.data;
    const { requestedBy } = bodyResult.data;

    const trace = {
      traceId: randomUUID(),
      requestedAt: new Date(),
      requestedBy: requestedBy ?? null,
    } as const;

    await adminStateStore.recordLatencyTrace(roomId, trace);
    await realtime.applyLatencyTrace({
      trace: {
        traceId: trace.traceId,
        requestedAt: trace.requestedAt.toISOString(),
        requestedBy: trace.requestedBy ?? 'system',
      },
    });

    await reply.send({
      trace: {
        traceId: trace.traceId,
        requestedAt: trace.requestedAt.toISOString(),
        requestedBy: trace.requestedBy ?? 'system',
      },
    });
  });

  app.post('/admin/rooms/:roomId/items/plant', async (request, reply) => {
    const paramsResult = tileParamsSchema.pick({ roomId: true }).safeParse(request.params);
    if (!paramsResult.success) {
      await reply.code(400).send({ message: 'Invalid room parameters', issues: paramsResult.error.issues });
      return;
    }

    const bodyResult = plantSpawnBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      await reply.code(400).send({ message: 'Invalid request body', issues: bodyResult.error.issues });
      return;
    }

    const { roomId } = paramsResult.data;
    const { tileX, tileY, updatedBy } = bodyResult.data;

    if (!isTileInBounds(tileX, tileY)) {
      await reply.code(400).send({ message: 'Tile is outside of the playable grid.' });
      return;
    }

    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      await reply.code(404).send({ message: 'Room not found' });
      return;
    }

    const tileFlag = await roomStore.getTileFlag(roomId, tileX, tileY);
    if (tileFlag?.locked) {
      await reply.code(409).send({ message: 'Cannot spawn items on a locked tile.' });
      return;
    }

    const record = await itemStore.createRoomItem({
      roomId,
      name: PLANT_TEMPLATE.name,
      description: PLANT_TEMPLATE.description,
      textureKey: PLANT_TEMPLATE.textureKey,
      tileX,
      tileY,
    });

    const roomSeq = await roomStore.incrementRoomSequence(roomId);

    await realtime.applyItemSpawn({
      item: record,
      roomSeq,
      createdBy: updatedBy,
    });

    await reply.code(201).send({
      item: {
        id: record.id,
        name: record.name,
        description: record.description,
        textureKey: record.textureKey,
        tileX: record.tileX,
        tileY: record.tileY,
        roomSeq,
      },
    });
  });

  done();
};
