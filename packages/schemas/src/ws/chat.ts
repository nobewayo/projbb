import { z } from 'zod';
import { buildEnvelopeSchema } from './envelope.js';

export const chatSendRequestDataSchema = z.object({
  body: z.string().min(1, 'body is required').max(500, 'body must be 500 characters or fewer'),
  idempotencyKey: z.string().min(1).max(64).optional(),
});

export const chatSendRequestEnvelopeSchema = buildEnvelopeSchema(chatSendRequestDataSchema);

export const chatMessageBroadcastSchema = z.object({
  id: z.string().min(1, 'message id required'),
  userId: z.string().min(1, 'userId required'),
  username: z.string().min(1, 'username required'),
  roles: z.array(z.string()).default([]),
  body: z.string().min(1),
  createdAt: z.string().min(1),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
});

export const chatMessageBroadcastEnvelopeSchema = buildEnvelopeSchema(
  chatMessageBroadcastSchema,
);

export const chatSendRequestJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['body'],
  properties: {
    body: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
    },
    idempotencyKey: {
      type: 'string',
      minLength: 1,
      maxLength: 64,
    },
  },
} as const;

export const chatMessageBroadcastJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'userId', 'username', 'roles', 'body', 'createdAt', 'roomSeq'],
  properties: {
    id: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
    username: { type: 'string', minLength: 1 },
    roles: {
      type: 'array',
      items: { type: 'string' },
    },
    body: { type: 'string', minLength: 1 },
    createdAt: { type: 'string', minLength: 1, format: 'date-time' },
    roomSeq: { type: 'integer', minimum: 0 },
  },
} as const;

export type ChatSendRequest = z.infer<typeof chatSendRequestDataSchema>;
export type ChatMessageBroadcast = z.infer<typeof chatMessageBroadcastSchema>;
