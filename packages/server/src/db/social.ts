import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export interface TradeSessionRecord {
  id: string;
  initiatorId: string;
  recipientId: string;
  roomId: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  createdAt: Date;
  acceptedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelledReason: 'cancelled' | 'declined' | null;
}

export interface MuteRecord {
  id: string;
  userId: string;
  mutedUserId: string;
  roomId: string;
  createdAt: Date;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedUserId: string;
  roomId: string;
  reason: string;
  createdAt: Date;
}

export interface UserProfileRecord {
  id: string;
  username: string;
  roles: string[];
  createdAt: Date;
}

export interface SocialStore {
  createTradeSession(params: {
    initiatorId: string;
    recipientId: string;
    roomId: string;
  }): Promise<TradeSessionRecord>;
  getTradeSessionById(tradeId: string): Promise<TradeSessionRecord | null>;
  getLatestTradeSessionForUser(userId: string): Promise<TradeSessionRecord | null>;
  updateTradeSessionStatus(params: {
    tradeId: string;
    actorId: string;
    status: 'accepted' | 'completed' | 'cancelled';
    reason?: 'cancelled' | 'declined';
  }): Promise<TradeSessionRecord | null>;
  recordMute(params: {
    userId: string;
    mutedUserId: string;
    roomId: string;
  }): Promise<MuteRecord>;
  recordReport(params: {
    reporterId: string;
    reportedUserId: string;
    roomId: string;
    reason: string;
  }): Promise<ReportRecord>;
  getUserProfile(userId: string): Promise<UserProfileRecord | null>;
  listMutesForUser(userId: string): Promise<MuteRecord[]>;
  listReportsByUser(userId: string): Promise<ReportRecord[]>;
}

export const createSocialStore = (pool: Pool): SocialStore => {
  const mapTradeRow = (row: {
    id: string;
    initiator_id: string;
    recipient_id: string;
    room_id: string;
    status: 'pending' | 'accepted' | 'completed' | 'cancelled';
    created_at: Date | string;
    accepted_at: Date | string | null;
    completed_at: Date | string | null;
    cancelled_at: Date | string | null;
    cancelled_by: string | null;
    cancelled_reason: 'cancelled' | 'declined' | null;
  }): TradeSessionRecord => ({
    id: row.id,
    initiatorId: row.initiator_id,
    recipientId: row.recipient_id,
    roomId: row.room_id,
    status: row.status,
    createdAt: new Date(row.created_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    cancelledBy: row.cancelled_by,
    cancelledReason: row.cancelled_reason ?? null,
  });

  const createTradeSession: SocialStore['createTradeSession'] = async ({
    initiatorId,
    recipientId,
    roomId,
  }) => {
    const id = randomUUID();
    const result = await pool.query<{
      id: string;
      initiator_id: string;
      recipient_id: string;
      room_id: string;
      status: 'pending' | 'accepted' | 'completed' | 'cancelled';
      created_at: Date | string;
      accepted_at: Date | string | null;
      completed_at: Date | string | null;
      cancelled_at: Date | string | null;
      cancelled_by: string | null;
      cancelled_reason: 'cancelled' | 'declined' | null;
    }>(
      `INSERT INTO trade_session (id, initiator_id, recipient_id, room_id, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                   accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason`,
      [id, initiatorId, recipientId, roomId],
    );

    return mapTradeRow(result.rows[0]);
  };

  const getTradeSessionById: SocialStore['getTradeSessionById'] = async (tradeId) => {
    const result = await pool.query<{
      id: string;
      initiator_id: string;
      recipient_id: string;
      room_id: string;
      status: 'pending' | 'accepted' | 'completed' | 'cancelled';
      created_at: Date | string;
      accepted_at: Date | string | null;
      completed_at: Date | string | null;
      cancelled_at: Date | string | null;
      cancelled_by: string | null;
      cancelled_reason: 'cancelled' | 'declined' | null;
    }>(
      `SELECT id, initiator_id, recipient_id, room_id, status, created_at,
              accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason
         FROM trade_session
        WHERE id = $1
        LIMIT 1`,
      [tradeId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapTradeRow(result.rows[0]);
  };

  const getLatestTradeSessionForUser: SocialStore['getLatestTradeSessionForUser'] = async (
    userId,
  ) => {
    const result = await pool.query<{
      id: string;
      initiator_id: string;
      recipient_id: string;
      room_id: string;
      status: 'pending' | 'accepted' | 'completed' | 'cancelled';
      created_at: Date | string;
      accepted_at: Date | string | null;
      completed_at: Date | string | null;
      cancelled_at: Date | string | null;
      cancelled_by: string | null;
      cancelled_reason: 'cancelled' | 'declined' | null;
    }>(
      `SELECT id, initiator_id, recipient_id, room_id, status, created_at,
              accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason
         FROM trade_session
        WHERE initiator_id = $1
           OR recipient_id = $1
        ORDER BY COALESCE(completed_at, cancelled_at, accepted_at, created_at) DESC,
                 created_at DESC
        LIMIT 1`,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapTradeRow(result.rows[0]);
  };

  const updateTradeSessionStatus: SocialStore['updateTradeSessionStatus'] = async ({
    tradeId,
    actorId,
    status,
    reason,
  }) => {
    if (status === 'accepted') {
      const result = await pool.query<{
        id: string;
        initiator_id: string;
        recipient_id: string;
        room_id: string;
        status: 'pending' | 'accepted' | 'completed' | 'cancelled';
        created_at: Date | string;
        accepted_at: Date | string | null;
        completed_at: Date | string | null;
        cancelled_at: Date | string | null;
        cancelled_by: string | null;
        cancelled_reason: 'cancelled' | 'declined' | null;
      }>(
        `UPDATE trade_session
            SET status = 'accepted',
                accepted_at = now(),
                cancelled_at = NULL,
                cancelled_by = NULL,
                cancelled_reason = NULL
          WHERE id = $1
            AND status = 'pending'
            AND recipient_id = $2
          RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                    accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason`,
        [tradeId, actorId],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return mapTradeRow(result.rows[0]);
    }

    if (status === 'cancelled') {
      const cancellationReason = reason ?? 'cancelled';
      const result = await pool.query<{
        id: string;
        initiator_id: string;
        recipient_id: string;
        room_id: string;
        status: 'pending' | 'accepted' | 'completed' | 'cancelled';
        created_at: Date | string;
        accepted_at: Date | string | null;
        completed_at: Date | string | null;
        cancelled_at: Date | string | null;
        cancelled_by: string | null;
        cancelled_reason: 'cancelled' | 'declined' | null;
      }>(
        `UPDATE trade_session
            SET status = 'cancelled',
                cancelled_at = now(),
                cancelled_by = $2,
                cancelled_reason = $3
          WHERE id = $1
            AND status IN ('pending', 'accepted')
            AND (initiator_id = $2 OR recipient_id = $2)
          RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                    accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason`,
        [tradeId, actorId, cancellationReason],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return mapTradeRow(result.rows[0]);
    }

    const result = await pool.query<{
      id: string;
      initiator_id: string;
      recipient_id: string;
      room_id: string;
      status: 'pending' | 'accepted' | 'completed' | 'cancelled';
      created_at: Date | string;
      accepted_at: Date | string | null;
      completed_at: Date | string | null;
      cancelled_at: Date | string | null;
      cancelled_by: string | null;
      cancelled_reason: 'cancelled' | 'declined' | null;
    }>(
      `UPDATE trade_session
          SET status = 'completed',
              completed_at = now()
        WHERE id = $1
          AND status = 'accepted'
          AND (initiator_id = $2 OR recipient_id = $2)
        RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                  accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason`,
      [tradeId, actorId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapTradeRow(result.rows[0]);
  };

  const recordMute: SocialStore['recordMute'] = async ({
    userId,
    mutedUserId,
    roomId,
  }) => {
    const id = randomUUID();
    const result = await pool.query<{
      id: string;
      user_id: string;
      muted_user_id: string;
      room_id: string;
      created_at: Date | string;
    }>(
      `INSERT INTO user_mute (id, user_id, muted_user_id, room_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, muted_user_id) DO UPDATE
           SET room_id = EXCLUDED.room_id,
               created_at = now()
         RETURNING id, user_id, muted_user_id, room_id, created_at`,
      [id, userId, mutedUserId, roomId],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      mutedUserId: row.muted_user_id,
      roomId: row.room_id,
      createdAt: new Date(row.created_at),
    } satisfies MuteRecord;
  };

  const recordReport: SocialStore['recordReport'] = async ({
    reporterId,
    reportedUserId,
    roomId,
    reason,
  }) => {
    const id = randomUUID();
    const result = await pool.query<{
      id: string;
      reporter_id: string;
      reported_user_id: string;
      room_id: string;
      reason: string;
      created_at: Date | string;
    }>(
      `INSERT INTO user_report (id, reporter_id, reported_user_id, room_id, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, reporter_id, reported_user_id, room_id, reason, created_at`,
      [id, reporterId, reportedUserId, roomId, reason],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      roomId: row.room_id,
      reason: row.reason,
      createdAt: new Date(row.created_at),
    } satisfies ReportRecord;
  };

  const getUserProfile: SocialStore['getUserProfile'] = async (userId) => {
    const result = await pool.query<{
      id: string;
      username: string;
      roles: string[] | null;
      created_at: Date | string;
    }>(
      `SELECT id, username, roles, created_at
         FROM app_user
        WHERE id = $1
        LIMIT 1`,
      [userId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      roles: Array.isArray(row.roles) ? row.roles : [],
      createdAt: new Date(row.created_at),
    } satisfies UserProfileRecord;
  };

  const listMutesForUser: SocialStore['listMutesForUser'] = async (userId) => {
    const result = await pool.query<{
      id: string;
      user_id: string;
      muted_user_id: string;
      room_id: string;
      created_at: Date | string;
    }>(
      `SELECT id, user_id, muted_user_id, room_id, created_at
         FROM user_mute
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      mutedUserId: row.muted_user_id,
      roomId: row.room_id,
      createdAt: new Date(row.created_at),
    } satisfies MuteRecord));
  };

  const listReportsByUser: SocialStore['listReportsByUser'] = async (userId) => {
    const result = await pool.query<{
      id: string;
      reporter_id: string;
      reported_user_id: string;
      room_id: string;
      reason: string;
      created_at: Date | string;
    }>(
      `SELECT id, reporter_id, reported_user_id, room_id, reason, created_at
         FROM user_report
        WHERE reporter_id = $1
        ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      reporterId: row.reporter_id,
      reportedUserId: row.reported_user_id,
      roomId: row.room_id,
      reason: row.reason,
      createdAt: new Date(row.created_at),
    } satisfies ReportRecord));
  };

  return {
    createTradeSession,
    getTradeSessionById,
    getLatestTradeSessionForUser,
    updateTradeSessionStatus,
    recordMute,
    recordReport,
    getUserProfile,
    listMutesForUser,
    listReportsByUser,
  };
};
