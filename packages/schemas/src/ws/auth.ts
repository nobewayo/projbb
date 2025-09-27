// @module: shared-ws-auth
// @tags: websocket, auth, schema
import { z } from 'zod';

export const authRequestDataSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const authRequestJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['token'],
  properties: {
    token: {
      type: 'string',
      minLength: 1,
    },
  },
} as const;

export type AuthRequestData = z.infer<typeof authRequestDataSchema>;
