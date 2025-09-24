import { z } from 'zod';
import { buildEnvelopeSchema } from './envelope.js';

const tileCoordinateSchema = z.number().int().min(0, 'coordinate must be non-negative');

export const moveRequestDataSchema = z.object({
  x: tileCoordinateSchema,
  y: tileCoordinateSchema,
});

export const moveRequestEnvelopeSchema = buildEnvelopeSchema(moveRequestDataSchema);

const roomSeqSchema = z.number().int().min(0, 'roomSeq must be non-negative');

export const moveOkDataSchema = z.object({
  x: tileCoordinateSchema,
  y: tileCoordinateSchema,
  roomSeq: roomSeqSchema,
});

export const moveOkEnvelopeSchema = buildEnvelopeSchema(moveOkDataSchema);

export const moveErrorCodeSchema = z.enum([
  'invalid_tile',
  'locked_tile',
  'not_in_room',
]);

export const moveErrorDataSchema = z.object({
  code: moveErrorCodeSchema,
  message: z.string().min(1).optional(),
  at: z.object({
    x: tileCoordinateSchema,
    y: tileCoordinateSchema,
  }),
  current: z.object({
    x: tileCoordinateSchema,
    y: tileCoordinateSchema,
  }),
  roomSeq: roomSeqSchema,
});

export const moveErrorEnvelopeSchema = buildEnvelopeSchema(moveErrorDataSchema);

export type MoveErrorCode = z.infer<typeof moveErrorCodeSchema>;
