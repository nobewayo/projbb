import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export const TRADE_MAX_SLOTS_PER_USER = 3;

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
  initiatorReady: boolean;
  recipientReady: boolean;
}

export interface TradeProposalRecord {
  tradeId: string;
  slotIndex: number;
  offeredBy: string;
  inventoryItemId: string;
  roomItemId: string;
  name: string;
  description: string;
  textureKey: string;
  updatedAt: Date;
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
  updateTradeParticipantReadiness(params: {
    tradeId: string;
    actorId: string;
    ready: boolean;
  }): Promise<TradeSessionRecord | null>;
  listTradeProposalsForTrade(tradeId: string): Promise<TradeProposalRecord[]>;
  upsertTradeProposal(params: {
    tradeId: string;
    offeredBy: string;
    slotIndex: number;
    inventoryItemId: string;
  }): Promise<TradeProposalRecord | null>;
  removeTradeProposal(params: {
    tradeId: string;
    offeredBy: string;
    slotIndex: number;
  }): Promise<boolean>;
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
  const MAX_TRADE_SLOTS_PER_USER = TRADE_MAX_SLOTS_PER_USER;

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
    initiator_ready: boolean;
    recipient_ready: boolean;
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
    initiatorReady: row.initiator_ready,
    recipientReady: row.recipient_ready,
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
                   accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
                   initiator_ready, recipient_ready`,
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
              accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
              initiator_ready, recipient_ready
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
              accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
              initiator_ready, recipient_ready
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
                initiator_ready = false,
                recipient_ready = false,
                cancelled_at = NULL,
                cancelled_by = NULL,
                cancelled_reason = NULL
          WHERE id = $1
            AND status = 'pending'
            AND recipient_id = $2
          RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                    accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
                    initiator_ready, recipient_ready`,
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
                cancelled_reason = $3,
                initiator_ready = false,
                recipient_ready = false
          WHERE id = $1
            AND status IN ('pending', 'accepted')
            AND (initiator_id = $2 OR recipient_id = $2)
          RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                    accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
                    initiator_ready, recipient_ready`,
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
      initiator_ready: boolean;
      recipient_ready: boolean;
    }>(
      `UPDATE trade_session
          SET status = 'completed',
              completed_at = now()
        WHERE id = $1
          AND status = 'accepted'
          AND (initiator_id = $2 OR recipient_id = $2)
        RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                  accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
                  initiator_ready, recipient_ready`,
      [tradeId, actorId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapTradeRow(result.rows[0]);
  };

  const updateTradeParticipantReadiness: SocialStore['updateTradeParticipantReadiness'] = async ({
    tradeId,
    actorId,
    ready,
  }) => {
    const trade = await getTradeSessionById(tradeId);
    if (!trade) {
      return null;
    }

    if (trade.status !== 'accepted') {
      return null;
    }

    let column: 'initiator_ready' | 'recipient_ready';
    if (trade.initiatorId === actorId) {
      column = 'initiator_ready';
    } else if (trade.recipientId === actorId) {
      column = 'recipient_ready';
    } else {
      return null;
    }

    if (ready) {
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
           FROM trade_proposal
          WHERE trade_id = $1
            AND offered_by = $2`,
        [tradeId, actorId],
      );

      const count = Number.parseInt(countResult.rows[0]?.count ?? '0', 10);
      if (!Number.isFinite(count) || count === 0) {
        return null;
      }
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
      initiator_ready: boolean;
      recipient_ready: boolean;
    }>(
      `UPDATE trade_session
          SET ${column} = $3
        WHERE id = $1
          AND (initiator_id = $2 OR recipient_id = $2)
        RETURNING id, initiator_id, recipient_id, room_id, status, created_at,
                  accepted_at, completed_at, cancelled_at, cancelled_by, cancelled_reason,
                  initiator_ready, recipient_ready`,
      [tradeId, actorId, ready],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapTradeRow(result.rows[0]);
  };

  const listTradeProposalsForTrade: SocialStore['listTradeProposalsForTrade'] = async (tradeId) => {
    const result = await pool.query<{
      trade_id: string;
      offered_by: string;
      slot_index: number;
      inventory_item_id: string;
      room_item_id: string;
      name: string;
      description: string;
      texture_key: string;
      updated_at: Date | string;
    }>(
      `SELECT tp.trade_id, tp.offered_by, tp.slot_index, tp.inventory_item_id,
              uii.room_item_id, ri.name, ri.description, ri.texture_key, tp.updated_at
         FROM trade_proposal tp
         JOIN user_inventory_item uii ON uii.id = tp.inventory_item_id
         JOIN room_item ri ON ri.id = uii.room_item_id
        WHERE tp.trade_id = $1
        ORDER BY tp.offered_by ASC, tp.slot_index ASC`,
      [tradeId],
    );

    return result.rows.map((row) => ({
      tradeId: row.trade_id,
      offeredBy: row.offered_by,
      slotIndex: row.slot_index,
      inventoryItemId: row.inventory_item_id,
      roomItemId: row.room_item_id,
      name: row.name,
      description: row.description,
      textureKey: row.texture_key,
      updatedAt: new Date(row.updated_at),
    } satisfies TradeProposalRecord));
  };

  const removeTradeProposalsForItem = async (tradeId: string, inventoryItemId: string) => {
    await pool.query(
      `DELETE FROM trade_proposal
        WHERE trade_id = $1
          AND inventory_item_id = $2`,
      [tradeId, inventoryItemId],
    );
  };

  const resetReadinessForParticipant = async (tradeId: string, participantId: string) => {
    await pool.query(
      `UPDATE trade_session
          SET initiator_ready = CASE WHEN initiator_id = $2 THEN false ELSE initiator_ready END,
              recipient_ready = CASE WHEN recipient_id = $2 THEN false ELSE recipient_ready END
        WHERE id = $1`,
      [tradeId, participantId],
    );
  };

  const upsertTradeProposal: SocialStore['upsertTradeProposal'] = async ({
    tradeId,
    offeredBy,
    slotIndex,
    inventoryItemId,
  }) => {
    if (slotIndex < 0 || slotIndex >= MAX_TRADE_SLOTS_PER_USER) {
      return null;
    }

    const trade = await getTradeSessionById(tradeId);
    if (!trade) {
      return null;
    }

    if (trade.status !== 'accepted') {
      return null;
    }

    if (trade.initiatorId !== offeredBy && trade.recipientId !== offeredBy) {
      return null;
    }

    const itemResult = await pool.query<{
      id: string;
      user_id: string;
      room_item_id: string;
      name: string;
      description: string;
      texture_key: string;
    }>(
      `SELECT uii.id, uii.user_id, uii.room_item_id, ri.name, ri.description, ri.texture_key
         FROM user_inventory_item uii
         JOIN room_item ri ON ri.id = uii.room_item_id
        WHERE uii.id = $1
          AND uii.user_id = $2
        LIMIT 1`,
      [inventoryItemId, offeredBy],
    );

    if (itemResult.rowCount === 0) {
      return null;
    }

    const itemRow = itemResult.rows[0];

    await removeTradeProposalsForItem(tradeId, inventoryItemId);

    const result = await pool.query<{
      trade_id: string;
      offered_by: string;
      slot_index: number;
      inventory_item_id: string;
      updated_at: Date | string;
    }>(
      `INSERT INTO trade_proposal (trade_id, offered_by, slot_index, inventory_item_id, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (trade_id, offered_by, slot_index)
         DO UPDATE SET inventory_item_id = EXCLUDED.inventory_item_id, updated_at = now()
         RETURNING trade_id, offered_by, slot_index, inventory_item_id, updated_at`,
      [tradeId, offeredBy, slotIndex, inventoryItemId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    await resetReadinessForParticipant(tradeId, offeredBy);

    const row = result.rows[0];
    return {
      tradeId: row.trade_id,
      offeredBy: row.offered_by,
      slotIndex: row.slot_index,
      inventoryItemId: row.inventory_item_id,
      roomItemId: itemRow.room_item_id,
      name: itemRow.name,
      description: itemRow.description,
      textureKey: itemRow.texture_key,
      updatedAt: new Date(row.updated_at),
    } satisfies TradeProposalRecord;
  };

  const removeTradeProposal: SocialStore['removeTradeProposal'] = async ({
    tradeId,
    offeredBy,
    slotIndex,
  }) => {
    if (slotIndex < 0 || slotIndex >= MAX_TRADE_SLOTS_PER_USER) {
      return false;
    }

    const trade = await getTradeSessionById(tradeId);
    if (!trade) {
      return false;
    }

    if (trade.initiatorId !== offeredBy && trade.recipientId !== offeredBy) {
      return false;
    }

    const result = await pool.query(
      `DELETE FROM trade_proposal
        WHERE trade_id = $1
          AND offered_by = $2
          AND slot_index = $3`,
      [tradeId, offeredBy, slotIndex],
    );

    if (result.rowCount === 0) {
      return false;
    }

    await resetReadinessForParticipant(tradeId, offeredBy);
    return true;
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
    updateTradeParticipantReadiness,
    listTradeProposalsForTrade,
    upsertTradeProposal,
    removeTradeProposal,
    recordMute,
    recordReport,
    getUserProfile,
    listMutesForUser,
    listReportsByUser,
  };
};
