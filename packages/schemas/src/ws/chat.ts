import { z } from 'zod';
import { buildEnvelopeSchema } from './envelope.js';

export const chatSendRequestDataSchema = z.object({
  body: z
    .string()
    .min(1, 'body is required')
    .max(500, 'body must be 500 characters or fewer'),
  idempotencyKey: z.string().min(1).max(64).optional(),
});

export const chatSendRequestEnvelopeSchema = buildEnvelopeSchema(
  chatSendRequestDataSchema,
);

export const chatTypingUpdateDataSchema = z.object({
  preview: z
    .string()
    .max(120, 'preview must be 120 characters or fewer')
    .optional(),
  isTyping: z.boolean(),
});

export const chatTypingUpdateEnvelopeSchema = buildEnvelopeSchema(
  chatTypingUpdateDataSchema,
);

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

export const chatTypingBroadcastSchema = z.object({
  userId: z.string().min(1, 'userId required'),
  isTyping: z.boolean(),
  preview: z
    .string()
    .max(120, 'preview must be 120 characters or fewer')
    .optional(),
  expiresAt: z.string().datetime().optional(),
});

export const chatTypingBroadcastEnvelopeSchema = buildEnvelopeSchema(
  chatTypingBroadcastSchema,
);

export const chatPreferencesSchema = z.object({
  showSystemMessages: z.boolean(),
});

export const chatPreferenceUpdateDataSchema = chatPreferencesSchema;

export const chatPreferenceUpdateEnvelopeSchema = buildEnvelopeSchema(
  chatPreferenceUpdateDataSchema,
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
export type ChatTypingUpdate = z.infer<typeof chatTypingUpdateDataSchema>;
export type ChatTypingBroadcast = z.infer<typeof chatTypingBroadcastSchema>;
export type ChatPreferences = z.infer<typeof chatPreferencesSchema>;
