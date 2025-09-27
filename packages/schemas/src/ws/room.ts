// @module: shared-ws-room
// @tags: websocket, room, schema
import { z } from 'zod';
import { adminStateSchema } from './admin.js';

export const roomTileFlagSchema = z.object({
  x: z.number().int().min(0, 'tile.x must be non-negative'),
  y: z.number().int().min(0, 'tile.y must be non-negative'),
  locked: z.boolean(),
  noPickup: z.boolean(),
});

export const roomOccupantSchema = z.object({
  id: z.string().min(1, 'occupant id required'),
  username: z.string().min(1, 'occupant username required'),
  roles: z.array(z.string()).default([]),
  position: z.object({
    x: z.number().int().min(0, 'occupant position.x must be non-negative'),
    y: z.number().int().min(0, 'occupant position.y must be non-negative'),
  }),
});

export const roomItemSchema = z.object({
  id: z.string().min(1, 'item id required'),
  name: z.string().min(1, 'item name required'),
  description: z.string().min(1, 'item description required'),
  tileX: z.number().int().min(0, 'item tileX must be non-negative'),
  tileY: z.number().int().min(0, 'item tileY must be non-negative'),
  textureKey: z.string().min(1, 'item texture key required'),
});

export const roomSnapshotSchema = z.object({
  id: z.string().min(1, 'room id required'),
  name: z.string().min(1, 'room name required'),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
  occupants: z.array(roomOccupantSchema),
  tiles: z.array(roomTileFlagSchema),
  items: z.array(roomItemSchema),
  adminState: adminStateSchema,
});

export const roomOccupantMovedDataSchema = z.object({
  occupant: roomOccupantSchema,
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
});

export const roomOccupantLeftDataSchema = z.object({
  occupantId: z.string().min(1, 'occupant id required'),
  lastPosition: z
    .object({
      x: z.number().int().min(0, 'position.x must be non-negative'),
      y: z.number().int().min(0, 'position.y must be non-negative'),
    })
    .optional(),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
});

export type RoomTileFlag = z.infer<typeof roomTileFlagSchema>;
export type RoomOccupant = z.infer<typeof roomOccupantSchema>;
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type RoomItem = z.infer<typeof roomItemSchema>;
export type RoomOccupantMovedData = z.infer<typeof roomOccupantMovedDataSchema>;
export type RoomOccupantLeftData = z.infer<typeof roomOccupantLeftDataSchema>;
