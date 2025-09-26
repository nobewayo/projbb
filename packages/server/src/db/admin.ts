import type { Pool } from 'pg';

export interface DevAffordanceState {
  gridVisible: boolean;
  showHoverWhenGridHidden: boolean;
  moveAnimationsEnabled: boolean;
}

export interface LatencyTraceState {
  traceId: string;
  requestedAt: Date;
  requestedBy: string | null;
}

export interface RoomAdminStateRecord {
  roomId: string;
  affordances: DevAffordanceState;
  lastLatencyTrace: LatencyTraceState | null;
}

export interface AdminStateStore {
  getRoomState(roomId: string): Promise<RoomAdminStateRecord>;
  updateAffordances(
    roomId: string,
    updates: Partial<DevAffordanceState>,
  ): Promise<RoomAdminStateRecord>;
  recordLatencyTrace(
    roomId: string,
    trace: { traceId: string; requestedAt: Date; requestedBy: string | null },
  ): Promise<RoomAdminStateRecord>;
}

const DEFAULT_AFFORDANCES: DevAffordanceState = {
  gridVisible: true,
  showHoverWhenGridHidden: true,
  moveAnimationsEnabled: true,
};

const mapRow = (row: {
  room_id: string;
  grid_visible: boolean | null;
  show_hover_when_grid_hidden: boolean | null;
  move_animations_enabled: boolean | null;
  last_latency_trace_id: string | null;
  last_latency_trace_requested_at: Date | string | null;
  last_latency_trace_requested_by: string | null;
}): RoomAdminStateRecord => {
  const requestedAtRaw = row.last_latency_trace_requested_at;
  const requestedAt =
    requestedAtRaw instanceof Date
      ? requestedAtRaw
      : typeof requestedAtRaw === 'string'
        ? new Date(requestedAtRaw)
        : null;

  return {
    roomId: row.room_id,
    affordances: {
      gridVisible: row.grid_visible ?? DEFAULT_AFFORDANCES.gridVisible,
      showHoverWhenGridHidden:
        row.show_hover_when_grid_hidden ?? DEFAULT_AFFORDANCES.showHoverWhenGridHidden,
      moveAnimationsEnabled:
        row.move_animations_enabled ?? DEFAULT_AFFORDANCES.moveAnimationsEnabled,
    },
    lastLatencyTrace:
      row.last_latency_trace_id && requestedAt
        ? {
            traceId: row.last_latency_trace_id,
            requestedAt,
            requestedBy: row.last_latency_trace_requested_by,
          }
        : null,
  };
};

const serialiseTrace = (
  trace: LatencyTraceState | null,
): {
  id: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
} =>
  trace
    ? {
        id: trace.traceId,
        requestedAt: trace.requestedAt,
        requestedBy: trace.requestedBy,
      }
    : { id: null, requestedAt: null, requestedBy: null };

export const createAdminStateStore = (pool: Pool): AdminStateStore => {
  const getRoomState = async (roomId: string): Promise<RoomAdminStateRecord> => {
    const result = await pool.query({
      text: `SELECT room_id, grid_visible, show_hover_when_grid_hidden, move_animations_enabled,
                    last_latency_trace_id, last_latency_trace_requested_at, last_latency_trace_requested_by
               FROM room_admin_state
              WHERE room_id = $1
              LIMIT 1`,
      values: [roomId],
    });

    if (result.rowCount && result.rowCount > 0) {
      return mapRow(result.rows[0]);
    }

    return { roomId, affordances: { ...DEFAULT_AFFORDANCES }, lastLatencyTrace: null };
  };

  const upsertState = async (
    roomId: string,
    next: RoomAdminStateRecord,
  ): Promise<RoomAdminStateRecord> => {
    const trace = serialiseTrace(next.lastLatencyTrace);
    await pool.query({
      text: `INSERT INTO room_admin_state (
                room_id,
                grid_visible,
                show_hover_when_grid_hidden,
                move_animations_enabled,
                last_latency_trace_id,
                last_latency_trace_requested_at,
                last_latency_trace_requested_by,
                updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, now())
              ON CONFLICT (room_id) DO UPDATE
                SET grid_visible = EXCLUDED.grid_visible,
                    show_hover_when_grid_hidden = EXCLUDED.show_hover_when_grid_hidden,
                    move_animations_enabled = EXCLUDED.move_animations_enabled,
                    last_latency_trace_id = EXCLUDED.last_latency_trace_id,
                    last_latency_trace_requested_at = EXCLUDED.last_latency_trace_requested_at,
                    last_latency_trace_requested_by = EXCLUDED.last_latency_trace_requested_by,
                    updated_at = now()`,
      values: [
        roomId,
        next.affordances.gridVisible,
        next.affordances.showHoverWhenGridHidden,
        next.affordances.moveAnimationsEnabled,
        trace.id,
        trace.requestedAt,
        trace.requestedBy,
      ],
    });

    return next;
  };

  const updateAffordances = async (
    roomId: string,
    updates: Partial<DevAffordanceState>,
  ): Promise<RoomAdminStateRecord> => {
    const current = await getRoomState(roomId);
    const next: RoomAdminStateRecord = {
      ...current,
      affordances: {
        ...current.affordances,
        ...updates,
      },
    };

    return upsertState(roomId, next);
  };

  const recordLatencyTrace = async (
    roomId: string,
    trace: { traceId: string; requestedAt: Date; requestedBy: string | null },
  ): Promise<RoomAdminStateRecord> => {
    const current = await getRoomState(roomId);
    const next: RoomAdminStateRecord = {
      ...current,
      lastLatencyTrace: {
        traceId: trace.traceId,
        requestedAt: trace.requestedAt,
        requestedBy: trace.requestedBy,
      },
    };

    return upsertState(roomId, next);
  };

  return {
    getRoomState,
    updateAffordances,
    recordLatencyTrace,
  };
};
