// @module: shared-ws-trade
// @tags: websocket, trade, schema
import { z } from 'zod';
import {
  tradeNegotiationStateSchema,
  tradeParticipantSchema,
  tradeSessionSchema,
} from '../rest/occupants.js';

export const tradeLifecycleBroadcastSchema = z.object({
  trade: tradeSessionSchema,
  participant: tradeParticipantSchema,
  negotiation: tradeNegotiationStateSchema,
  actorId: z.string().uuid().optional(),
});

export type TradeLifecycleBroadcast = z.infer<typeof tradeLifecycleBroadcastSchema>;
