import { z } from 'zod';

export const socialMuteRecordSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  mutedUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  createdAt: z.string().min(1),
});

export const socialReportRecordSchema = z.object({
  id: z.string().uuid(),
  reporterId: z.string().uuid(),
  reportedUserId: z.string().uuid(),
  roomId: z.string().uuid(),
  reason: z.string().min(1),
  createdAt: z.string().min(1),
});

export const socialStateSchema = z.object({
  mutes: z.array(socialMuteRecordSchema),
  reports: z.array(socialReportRecordSchema),
});

export const socialMuteBroadcastSchema = z.object({
  mute: socialMuteRecordSchema,
});

export const socialReportBroadcastSchema = z.object({
  report: socialReportRecordSchema,
});

export type SocialMuteRecord = z.infer<typeof socialMuteRecordSchema>;
export type SocialReportRecord = z.infer<typeof socialReportRecordSchema>;
export type SocialState = z.infer<typeof socialStateSchema>;
export type SocialMuteBroadcast = z.infer<typeof socialMuteBroadcastSchema>;
export type SocialReportBroadcast = z.infer<typeof socialReportBroadcastSchema>;
