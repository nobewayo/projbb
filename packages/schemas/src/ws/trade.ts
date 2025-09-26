import { z } from 'zod';
import { tradeParticipantSchema, tradeSessionSchema } from '../rest/occupants.js';

export const tradeLifecycleBroadcastSchema = z.object({
  trade: tradeSessionSchema,
  participant: tradeParticipantSchema,
  actorId: z.string().uuid().optional(),
});

export type TradeLifecycleBroadcast = z.infer<typeof tradeLifecycleBroadcastSchema>;
