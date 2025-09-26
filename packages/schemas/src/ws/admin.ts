import { z } from 'zod';
export const adminDevAffordanceSchema = z.object({
  gridVisible: z.boolean(),
  showHoverWhenGridHidden: z.boolean(),
  moveAnimationsEnabled: z.boolean(),
});

const adminTileFlagSchema = z.object({
  x: z.number().int().min(0, 'tile.x must be non-negative'),
  y: z.number().int().min(0, 'tile.y must be non-negative'),
  locked: z.boolean(),
  noPickup: z.boolean(),
});

export const adminLatencyTraceSchema = z
  .object({
    traceId: z.string().uuid('traceId must be a UUID'),
    requestedAt: z
      .string()
      .datetime({ message: 'requestedAt must be an ISO 8601 timestamp' }),
    requestedBy: z.string().min(1, 'requestedBy must be provided'),
  })
  .strict();

export const adminStateSchema = z.object({
  affordances: adminDevAffordanceSchema,
  lastLatencyTrace: adminLatencyTraceSchema.nullable(),
});

export const adminTileFlagUpdateDataSchema = z.object({
  tile: adminTileFlagSchema,
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
  updatedBy: z.string().min(1, 'updatedBy must be provided'),
});

export const adminAffordanceUpdateDataSchema = z.object({
  state: adminDevAffordanceSchema,
  updatedBy: z.string().min(1, 'updatedBy must be provided'),
});

export const adminLatencyTraceEventDataSchema = z.object({
  trace: adminLatencyTraceSchema,
});

export type AdminTileFlag = z.infer<typeof adminTileFlagSchema>;
export type AdminDevAffordanceState = z.infer<typeof adminDevAffordanceSchema>;
export type AdminLatencyTrace = z.infer<typeof adminLatencyTraceSchema>;
export type AdminState = z.infer<typeof adminStateSchema>;
export type AdminTileFlagUpdateData = z.infer<typeof adminTileFlagUpdateDataSchema>;
export type AdminAffordanceUpdateData = z.infer<typeof adminAffordanceUpdateDataSchema>;
export type AdminLatencyTraceEventData = z.infer<typeof adminLatencyTraceEventDataSchema>;
