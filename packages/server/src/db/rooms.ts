import type { Pool } from 'pg';
import type { RoomSnapshotOccupant } from '../auth/types.js';

export interface RoomRecord {
  id: string;
  slug: string;
  name: string;
  roomSeq: number;
}

export interface TileFlagRecord {
  x: number;
  y: number;
  locked: boolean;
  noPickup: boolean;
}

export type RoomOccupantRecord = RoomSnapshotOccupant & { roomId: string | null };

export interface RoomStore {
  getRoomBySlug(slug: string): Promise<RoomRecord | null>;
  getRoomById(id: string): Promise<RoomRecord | null>;
  getTileFlags(roomId: string): Promise<TileFlagRecord[]>;
  listOccupants(roomId: string): Promise<RoomSnapshotOccupant[]>;
  getOccupant(userId: string): Promise<RoomOccupantRecord | null>;
  upsertOccupantPosition(
    userId: string,
    roomId: string,
    position: { x: number; y: number },
  ): Promise<RoomSnapshotOccupant>;
  clearOccupant(userId: string): Promise<void>;
  incrementRoomSequence(roomId: string): Promise<number>;
}

const mapRoomRow = (row: {
  id: string;
  slug: string;
  name: string;
  room_seq: string | number;
}): RoomRecord => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  roomSeq: typeof row.room_seq === 'number' ? row.room_seq : Number.parseInt(row.room_seq, 10),
});

const mapOccupantRow = (row: {
  id: string;
  username: string;
  roles: string[] | null;
  x: number;
  y: number;
  room_id?: string | null;
}): RoomSnapshotOccupant & { roomId: string | null } => ({
  id: row.id,
  username: row.username,
  roles: Array.isArray(row.roles) ? row.roles : [],
  position: { x: row.x, y: row.y },
  roomId: row.room_id ?? null,
});

export const createRoomStore = (pool: Pool): RoomStore => {
  const getRoomBySlug = async (slug: string): Promise<RoomRecord | null> => {
    const result = await pool.query<{ id: string; slug: string; name: string; room_seq: number }>(
      `SELECT id, slug, name, room_seq FROM room WHERE slug = $1 LIMIT 1`,
      [slug],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRoomRow(result.rows[0]);
  };

  const getRoomById = async (id: string): Promise<RoomRecord | null> => {
    const result = await pool.query<{ id: string; slug: string; name: string; room_seq: number }>(
      `SELECT id, slug, name, room_seq FROM room WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapRoomRow(result.rows[0]);
  };

  const getTileFlags = async (roomId: string): Promise<TileFlagRecord[]> => {
    const result = await pool.query<{ x: number; y: number; locked: boolean; no_pickup: boolean }>(
      `SELECT x, y, locked, no_pickup FROM room_tile_flag WHERE room_id = $1`,
      [roomId],
    );

    return result.rows.map((row) => ({
      x: row.x,
      y: row.y,
      locked: row.locked,
      noPickup: row.no_pickup,
    }));
  };

  const listOccupants = async (roomId: string): Promise<RoomSnapshotOccupant[]> => {
    const result = await pool.query<{
      id: string;
      username: string;
      roles: string[] | null;
      x: number;
      y: number;
    }>(
      `SELECT au.id, au.username, au.roles, ra.x, ra.y
         FROM room_avatar ra
         JOIN app_user au ON au.id = ra.user_id
        WHERE ra.room_id = $1
        ORDER BY ra.y ASC, ra.x ASC`,
      [roomId],
    );

    return result.rows.map((row) => {
      const { roomId: _roomId, ...rest } = mapOccupantRow(row);
      void _roomId;
      return rest;
    });
  };

  const getOccupant = async (userId: string): Promise<RoomOccupantRecord | null> => {
    const result = await pool.query<{
      id: string;
      username: string;
      roles: string[] | null;
      x: number;
      y: number;
      room_id: string | null;
    }>(
      `SELECT au.id, au.username, au.roles, ra.x, ra.y, ra.room_id
         FROM room_avatar ra
         JOIN app_user au ON au.id = ra.user_id
        WHERE ra.user_id = $1
        LIMIT 1`,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapOccupantRow(result.rows[0]);
  };

  const upsertOccupantPosition = async (
    userId: string,
    roomId: string,
    position: { x: number; y: number },
  ): Promise<RoomSnapshotOccupant> => {
    await pool.query(
      `INSERT INTO room_avatar (user_id, room_id, x, y)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id)
         DO UPDATE SET room_id = EXCLUDED.room_id, x = EXCLUDED.x, y = EXCLUDED.y, updated_at = now()`,
      [userId, roomId, position.x, position.y],
    );

    const occupant = await getOccupant(userId);
    if (!occupant) {
      throw new Error(`Occupant ${userId} missing after upsert`);
    }

    const { roomId: _roomId, ...rest } = occupant;
    void _roomId;
    return rest;
  };

  const clearOccupant = async (userId: string): Promise<void> => {
    await pool.query(`UPDATE room_avatar SET room_id = NULL WHERE user_id = $1`, [userId]);
  };

  const incrementRoomSequence = async (roomId: string): Promise<number> => {
    const result = await pool.query<{ room_seq: string | number }>(
      `UPDATE room SET room_seq = room_seq + 1 WHERE id = $1 RETURNING room_seq`,
      [roomId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Room ${roomId} not found when incrementing sequence`);
    }

    const value = result.rows[0].room_seq;
    return typeof value === 'number' ? value : Number.parseInt(value, 10);
  };

  return {
    getRoomBySlug,
    getRoomById,
    getTileFlags,
    listOccupants,
    getOccupant,
    upsertOccupantPosition,
    clearOccupant,
    incrementRoomSequence,
  };
};
