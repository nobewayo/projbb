import { z } from 'zod';
import { buildEnvelopeSchema } from './envelope.js';

const tileCoordinateSchema = z.number().int().min(0, 'coordinate must be non-negative');

export const moveRequestDataSchema = z.object({
  x: tileCoordinateSchema,
  y: tileCoordinateSchema,
});

export const moveRequestEnvelopeSchema = buildEnvelopeSchema(moveRequestDataSchema);

export const moveRequestJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y'],
  properties: {
    x: { type: 'integer', minimum: 0 },
    y: { type: 'integer', minimum: 0 },
  },
} as const;

const roomSeqSchema = z.number().int().min(0, 'roomSeq must be non-negative');

export const moveOkDataSchema = z.object({
  x: tileCoordinateSchema,
  y: tileCoordinateSchema,
  roomSeq: roomSeqSchema,
});

export const moveOkEnvelopeSchema = buildEnvelopeSchema(moveOkDataSchema);

export const moveOkJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'roomSeq'],
  properties: {
    x: { type: 'integer', minimum: 0 },
    y: { type: 'integer', minimum: 0 },
    roomSeq: { type: 'integer', minimum: 0 },
  },
} as const;

export const moveErrorCodeSchema = z.enum([
  'invalid_tile',
  'locked_tile',
  'not_in_room',
  'occupied',
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

export const moveErrorJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['code', 'at', 'current', 'roomSeq'],
  properties: {
    code: {
      type: 'string',
      enum: ['invalid_tile', 'locked_tile', 'not_in_room', 'occupied'],
    },
    message: { type: 'string' },
    at: {
      type: 'object',
      required: ['x', 'y'],
      additionalProperties: false,
      properties: {
        x: { type: 'integer', minimum: 0 },
        y: { type: 'integer', minimum: 0 },
      },
    },
    current: {
      type: 'object',
      required: ['x', 'y'],
      additionalProperties: false,
      properties: {
        x: { type: 'integer', minimum: 0 },
        y: { type: 'integer', minimum: 0 },
      },
    },
    roomSeq: { type: 'integer', minimum: 0 },
  },
} as const;

export type MoveErrorCode = z.infer<typeof moveErrorCodeSchema>;
