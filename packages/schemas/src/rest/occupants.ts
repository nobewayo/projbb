import { z } from 'zod';

export const occupantProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
  roles: z.array(z.string().min(1)),
  createdAt: z.string().min(1),
  inventoryCount: z.number().int().nonnegative(),
  position: z.object({
    x: z.number().int(),
    y: z.number().int(),
  }),
  room: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
  }),
});

export const occupantProfileResponseSchema = z.object({
  profile: occupantProfileSchema,
});

export const tradeSessionSchema = z.object({
  id: z.string().uuid(),
  initiatorId: z.string().uuid(),
  recipientId: z.string().uuid(),
  roomId: z.string().uuid(),
  status: z.enum(['pending', 'accepted', 'completed', 'cancelled']).default('pending'),
  createdAt: z.string().min(1),
  acceptedAt: z.string().min(1).optional(),
  completedAt: z.string().min(1).optional(),
  cancelledAt: z.string().min(1).optional(),
  cancelledBy: z.string().uuid().optional(),
  cancelledReason: z.enum(['cancelled', 'declined']).optional(),
});

export const tradeParticipantSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(1),
});

export const tradeBootstrapResponseSchema = z.object({
  trade: tradeSessionSchema,
  participant: tradeParticipantSchema,
});

export const tradeLifecycleResponseSchema = z.object({
  trade: tradeSessionSchema,
  participant: tradeParticipantSchema,
});

export const muteRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  mutedUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  createdAt: z.string().min(1),
});

export const muteResponseSchema = z.object({
  mute: muteRecordSchema,
});

export const reportRecordSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  reportedUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  reason: z.string().min(1),
  createdAt: z.string().min(1),
});

export const reportResponseSchema = z.object({
  report: reportRecordSchema,
});

export type OccupantProfile = z.infer<typeof occupantProfileSchema>;
export type TradeSession = z.infer<typeof tradeSessionSchema>;
export type TradeBootstrapResponse = z.infer<typeof tradeBootstrapResponseSchema>;
export type TradeLifecycleResponse = z.infer<typeof tradeLifecycleResponseSchema>;
export type MuteRecord = z.infer<typeof muteRecordSchema>;
export type MuteResponse = z.infer<typeof muteResponseSchema>;
export type ReportRecord = z.infer<typeof reportRecordSchema>;
export type ReportResponse = z.infer<typeof reportResponseSchema>;
