import { z } from 'zod';

export const roomTileFlagSchema = z.object({
  x: z.number().int().min(0, 'tile.x must be non-negative'),
  y: z.number().int().min(0, 'tile.y must be non-negative'),
  locked: z.boolean(),
  noPickup: z.boolean(),
});

export const roomOccupantSchema = z.object({
  id: z.string().min(1, 'occupant id required'),
  username: z.string().min(1, 'occupant username required'),
  roles: z.array(z.string()).default([]),
  position: z.object({
    x: z.number().int().min(0, 'occupant position.x must be non-negative'),
    y: z.number().int().min(0, 'occupant position.y must be non-negative'),
  }),
});

export const roomSnapshotSchema = z.object({
  id: z.string().min(1, 'room id required'),
  name: z.string().min(1, 'room name required'),
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
  occupants: z.array(roomOccupantSchema),
  tiles: z.array(roomTileFlagSchema),
});

export const roomOccupantMovedDataSchema = z.object({
  occupant: roomOccupantSchema,
  roomSeq: z.number().int().min(0, 'roomSeq must be non-negative'),
});

export type RoomTileFlag = z.infer<typeof roomTileFlagSchema>;
export type RoomOccupant = z.infer<typeof roomOccupantSchema>;
export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type RoomOccupantMovedData = z.infer<typeof roomOccupantMovedDataSchema>;
