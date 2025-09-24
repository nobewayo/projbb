import { z } from 'zod';
import { buildEnvelopeSchema } from './envelope.js';

const identifierSchema = z.string().min(1, 'id required');
const tileCoordinateSchema = z.number().int().min(0, 'coordinate must be non-negative');
const roomSeqSchema = z.number().int().min(0, 'roomSeq must be non-negative');

export const roomItemSchema = z.object({
  id: identifierSchema,
  name: z.string().min(1, 'item name required'),
  description: z.string().min(1, 'item description required'),
  tileX: tileCoordinateSchema,
  tileY: tileCoordinateSchema,
  texture: z.string().min(1, 'item texture key required'),
});

export const inventoryItemSchema = z.object({
  id: identifierSchema,
  catalogItemId: identifierSchema,
  roomItemId: identifierSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  texture: z.string().min(1),
  acquiredAt: z.string().min(1, 'acquiredAt timestamp required'),
});

export const itemPickupRequestDataSchema = z.object({
  itemId: identifierSchema,
});

export const itemPickupRequestEnvelopeSchema = buildEnvelopeSchema(itemPickupRequestDataSchema);

export const itemPickupOkDataSchema = z.object({
  itemId: identifierSchema,
  inventoryItem: inventoryItemSchema,
  roomSeq: roomSeqSchema,
});

export const itemPickupOkEnvelopeSchema = buildEnvelopeSchema(itemPickupOkDataSchema);

export const itemPickupErrorCodeSchema = z.enum([
  'not_available',
  'wrong_position',
  'tile_blocked',
  'unknown_item',
]);

export const itemPickupErrorDataSchema = z.object({
  itemId: identifierSchema,
  code: itemPickupErrorCodeSchema,
  message: z.string().min(1).optional(),
  roomSeq: roomSeqSchema.optional(),
});

export const itemPickupErrorEnvelopeSchema = buildEnvelopeSchema(itemPickupErrorDataSchema);

export const roomItemRemovedDataSchema = z.object({
  itemId: identifierSchema,
  roomSeq: roomSeqSchema,
  pickedUpBy: z
    .object({
      id: identifierSchema,
      username: z.string().min(1),
    })
    .optional(),
});

export const roomItemRemovedEnvelopeSchema = buildEnvelopeSchema(roomItemRemovedDataSchema);

export type RoomItem = z.infer<typeof roomItemSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type ItemPickupErrorCode = z.infer<typeof itemPickupErrorCodeSchema>;
