import { z } from 'zod';

export const adminQuickMenuStateSchema = z.object({
  showGrid: z.boolean(),
  showHoverWhenGridHidden: z.boolean(),
  moveAnimationsEnabled: z.boolean(),
  latencyTraceEnabled: z.boolean(),
  lockTilesEnabled: z.boolean(),
  noPickupEnabled: z.boolean(),
  updatedAt: z.string().datetime({ message: 'updatedAt must be an ISO timestamp' }),
  updatedBy: z.string().min(1).nullable().optional(),
});

export const adminQuickMenuUpdateSchema = adminQuickMenuStateSchema
  .omit({ updatedAt: true, updatedBy: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one admin quick menu flag must be provided',
  });

export type AdminQuickMenuState = z.infer<typeof adminQuickMenuStateSchema>;
export type AdminQuickMenuUpdate = z.infer<typeof adminQuickMenuUpdateSchema>;
