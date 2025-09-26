import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export interface TradeSessionRecord {
  id: string;
  initiatorId: string;
  recipientId: string;
  roomId: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
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
}

export const createSocialStore = (pool: Pool): SocialStore => {
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
      status: 'pending' | 'completed' | 'cancelled';
      created_at: Date | string;
    }>(
      `INSERT INTO trade_session (id, initiator_id, recipient_id, room_id, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id, initiator_id, recipient_id, room_id, status, created_at`,
      [id, initiatorId, recipientId, roomId],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      initiatorId: row.initiator_id,
      recipientId: row.recipient_id,
      roomId: row.room_id,
      status: row.status,
      createdAt: new Date(row.created_at),
    } satisfies TradeSessionRecord;
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

  return {
    createTradeSession,
    recordMute,
    recordReport,
    getUserProfile,
  };
};
