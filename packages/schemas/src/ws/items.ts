// @module: shared-ws-items
// @tags: websocket, items, schema
import { z } from 'zod';

import { roomItemSchema } from './room.js';

export const inventoryItemSchema = z.object({
  id: z.string().min(1, 'inventory id required'),
  roomItemId: z.string().min(1, 'room item id required'),
  roomId: z.string().min(1, 'room id required'),
  name: z.string().min(1, 'inventory item name required'),
  description: z.string().min(1, 'inventory item description required'),
  textureKey: z.string().min(1, 'inventory item texture key required'),
  acquiredAt: z.string().min(1, 'inventory acquiredAt timestamp required'),
});

export const itemPickupRequestDataSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
});

export const itemPickupOkDataSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
  inventoryItem: inventoryItemSchema,
});

export const itemPickupErrorCodeSchema = z.enum([
  'validation_failed',
  'not_in_room',
  'not_found',
  'tile_blocked',
  'not_on_tile',
  'already_picked_up',
  'persist_failed',
]);

export const itemPickupErrorDataSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
  code: itemPickupErrorCodeSchema,
  message: z.string().min(1, 'error message is required'),
});

export const roomItemRemovedDataSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
});

export const roomItemAddedDataSchema = z.object({
  item: roomItemSchema,
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
});

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type ItemPickupRequestData = z.infer<typeof itemPickupRequestDataSchema>;
export type ItemPickupOkData = z.infer<typeof itemPickupOkDataSchema>;
export type ItemPickupErrorData = z.infer<typeof itemPickupErrorDataSchema>;
export type ItemPickupErrorCode = z.infer<typeof itemPickupErrorCodeSchema>;
export type RoomItemRemovedData = z.infer<typeof roomItemRemovedDataSchema>;
export type RoomItemAddedData = z.infer<typeof roomItemAddedDataSchema>;

export { roomItemSchema };
