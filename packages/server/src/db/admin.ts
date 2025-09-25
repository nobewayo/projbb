import type { Pool } from 'pg';
import type { AdminQuickMenuState } from '@bitby/schemas';

export interface RoomAdminStateRecord {
  roomId: string;
  showGrid: boolean;
  showHoverWhenGridHidden: boolean;
  moveAnimationsEnabled: boolean;
  latencyTraceEnabled: boolean;
  lockTilesEnabled: boolean;
  noPickupEnabled: boolean;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface UpdateAdminStateInput {
  showGrid?: boolean;
  showHoverWhenGridHidden?: boolean;
  moveAnimationsEnabled?: boolean;
  latencyTraceEnabled?: boolean;
  lockTilesEnabled?: boolean;
  noPickupEnabled?: boolean;
}

export interface AdminStateStore {
  getRoomState(roomId: string): Promise<RoomAdminStateRecord>;
  updateRoomState(
    roomId: string,
    patch: UpdateAdminStateInput,
    options: { updatedBy?: string | null }
  ): Promise<RoomAdminStateRecord>;
}

const mapRow = (row: {
  room_id: string;
  show_grid: boolean;
  show_hover_when_grid_hidden: boolean;
  move_animations_enabled: boolean;
  latency_trace_enabled: boolean;
  lock_tiles_enabled: boolean;
  no_pickup_enabled: boolean;
  updated_at: Date;
  updated_by: string | null;
}): RoomAdminStateRecord => ({
  roomId: row.room_id,
  showGrid: row.show_grid,
  showHoverWhenGridHidden: row.show_hover_when_grid_hidden,
  moveAnimationsEnabled: row.move_animations_enabled,
  latencyTraceEnabled: row.latency_trace_enabled,
  lockTilesEnabled: row.lock_tiles_enabled,
  noPickupEnabled: row.no_pickup_enabled,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

export const createAdminStateStore = (pool: Pool): AdminStateStore => {
  const ensureRow = async (roomId: string): Promise<void> => {
    await pool.query(
      `INSERT INTO room_admin_state (room_id)
         VALUES ($1)
         ON CONFLICT (room_id) DO NOTHING`,
      [roomId],
    );
  };

  const getRoomState = async (roomId: string): Promise<RoomAdminStateRecord> => {
    const result = await pool.query<{
      room_id: string;
      show_grid: boolean;
      show_hover_when_grid_hidden: boolean;
      move_animations_enabled: boolean;
      latency_trace_enabled: boolean;
      lock_tiles_enabled: boolean;
      no_pickup_enabled: boolean;
      updated_at: Date;
      updated_by: string | null;
    }>(
      `SELECT room_id,
              show_grid,
              show_hover_when_grid_hidden,
              move_animations_enabled,
              latency_trace_enabled,
              lock_tiles_enabled,
              no_pickup_enabled,
              updated_at,
              updated_by
         FROM room_admin_state
        WHERE room_id = $1
        LIMIT 1`,
      [roomId],
    );

    if (result.rowCount === 0) {
      await ensureRow(roomId);
      const retry = await pool.query(
        `SELECT room_id,
                show_grid,
                show_hover_when_grid_hidden,
                move_animations_enabled,
                latency_trace_enabled,
                lock_tiles_enabled,
                no_pickup_enabled,
                updated_at,
                updated_by
           FROM room_admin_state
          WHERE room_id = $1
          LIMIT 1`,
        [roomId],
      );
      if (retry.rowCount === 0) {
        throw new Error(`Failed to materialise admin state for room ${roomId}`);
      }
      return mapRow(retry.rows[0]);
    }

    return mapRow(result.rows[0]);
  };

  const updateRoomState = async (
    roomId: string,
    patch: UpdateAdminStateInput,
    options: { updatedBy?: string | null } = {},
  ): Promise<RoomAdminStateRecord> => {
    const fields: string[] = [];
    const values: unknown[] = [roomId];
    let index = 2;

    if (typeof patch.showGrid === 'boolean') {
      fields.push(`show_grid = $${index}`);
      values.push(patch.showGrid);
      index += 1;
    }
    if (typeof patch.showHoverWhenGridHidden === 'boolean') {
      fields.push(`show_hover_when_grid_hidden = $${index}`);
      values.push(patch.showHoverWhenGridHidden);
      index += 1;
    }
    if (typeof patch.moveAnimationsEnabled === 'boolean') {
      fields.push(`move_animations_enabled = $${index}`);
      values.push(patch.moveAnimationsEnabled);
      index += 1;
    }
    if (typeof patch.latencyTraceEnabled === 'boolean') {
      fields.push(`latency_trace_enabled = $${index}`);
      values.push(patch.latencyTraceEnabled);
      index += 1;
    }
    if (typeof patch.lockTilesEnabled === 'boolean') {
      fields.push(`lock_tiles_enabled = $${index}`);
      values.push(patch.lockTilesEnabled);
      index += 1;
    }
    if (typeof patch.noPickupEnabled === 'boolean') {
      fields.push(`no_pickup_enabled = $${index}`);
      values.push(patch.noPickupEnabled);
      index += 1;
    }

    if (fields.length === 0) {
      return getRoomState(roomId);
    }

    const updatedBy = options.updatedBy ?? null;
    fields.push(`updated_at = now()`);
    fields.push(`updated_by = $${index}`);
    values.push(updatedBy);

    const result = await pool.query<{
      room_id: string;
      show_grid: boolean;
      show_hover_when_grid_hidden: boolean;
      move_animations_enabled: boolean;
      latency_trace_enabled: boolean;
      lock_tiles_enabled: boolean;
      no_pickup_enabled: boolean;
      updated_at: Date;
      updated_by: string | null;
    }>(
      `UPDATE room_admin_state
          SET ${fields.join(', ')}
        WHERE room_id = $1
        RETURNING room_id,
                  show_grid,
                  show_hover_when_grid_hidden,
                  move_animations_enabled,
                  latency_trace_enabled,
                  lock_tiles_enabled,
                  no_pickup_enabled,
                  updated_at,
                  updated_by`,
      values,
    );

    if (result.rowCount === 0) {
      await ensureRow(roomId);
      return updateRoomState(roomId, patch, options);
    }

    return mapRow(result.rows[0]);
  };

  return {
    getRoomState,
    updateRoomState,
  };
};

export const toAdminStatePayload = (
  record: RoomAdminStateRecord,
): AdminQuickMenuState => ({
  showGrid: record.showGrid,
  showHoverWhenGridHidden: record.showHoverWhenGridHidden,
  moveAnimationsEnabled: record.moveAnimationsEnabled,
  latencyTraceEnabled: record.latencyTraceEnabled,
  lockTilesEnabled: record.lockTilesEnabled,
  noPickupEnabled: record.noPickupEnabled,
  updatedAt: record.updatedAt.toISOString(),
  updatedBy: record.updatedBy ?? null,
});
