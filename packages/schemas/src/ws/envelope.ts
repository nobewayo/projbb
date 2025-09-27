// @module: shared-ws-envelope
// @tags: websocket, schema, helpers
import { z } from 'zod';

export type MessageEnvelope<Data = Record<string, unknown>> = {
  op: string;
  seq: number;
  ts: number;
  data: Data;
};

export const messageEnvelopeSchema = z.object({
  op: z.string().min(1, 'op is required'),
  seq: z.number().int().min(0, 'seq must be a non-negative integer'),
  ts: z.number().int().min(0, 'ts must be a unix timestamp in seconds'),
  data: z.record(z.string(), z.unknown()).default({})
});

export const buildEnvelopeSchema = <Schema extends z.ZodTypeAny>(dataSchema: Schema) =>
  messageEnvelopeSchema.extend({
    data: dataSchema
  }) as z.ZodType<MessageEnvelope<z.infer<Schema>>>;
