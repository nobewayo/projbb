import type { Pool } from 'pg';

export interface AuditLogRecord {
  id: number;
  userId: string;
  roomId: string | null;
  action: string;
  context: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditLogStore {
  recordAdminAction(entry: {
    userId: string;
    roomId: string | null;
    action: string;
    context?: Record<string, unknown>;
  }): Promise<AuditLogRecord>;
  listRecentAdminActions(options?: {
    limit?: number;
    roomId?: string | null;
  }): Promise<AuditLogRecord[]>;
}

const parseContext = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return raw as Record<string, unknown>;
};

const mapRow = (row: {
  id: number;
  user_id: string;
  room_id: string | null;
  action: string;
  ctx: unknown;
  created_at: Date | string;
}): AuditLogRecord => ({
  id: row.id,
  userId: row.user_id,
  roomId: row.room_id,
  action: row.action,
  context: parseContext(row.ctx),
  createdAt:
    row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
});

export const createAuditLogStore = (pool: Pool): AuditLogStore => {
  const recordAdminAction: AuditLogStore['recordAdminAction'] = async ({
    userId,
    roomId,
    action,
    context,
  }) => {
    const result = await pool.query({
      text: `INSERT INTO audit_log (user_id, room_id, action, ctx)
             VALUES ($1, $2, $3, $4::jsonb)
             RETURNING id, user_id, room_id, action, ctx, created_at`,
      values: [userId, roomId, action, JSON.stringify(context ?? {})],
    });

    return mapRow(result.rows[0]);
  };

  const listRecentAdminActions: AuditLogStore['listRecentAdminActions'] = async (
    options = {},
  ) => {
    const limit = options.limit ?? 20;
    const values: unknown[] = [];
    const where: string[] = [];

    if (typeof options.roomId === 'string') {
      values.push(options.roomId);
      where.push(`room_id = $${values.length}`);
    }

    values.push(limit);
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query({
      text: `SELECT id, user_id, room_id, action, ctx, created_at
               FROM audit_log
               ${whereClause}
              ORDER BY created_at DESC, id DESC
              LIMIT $${values.length}`,
      values,
    });

    return result.rows.map(mapRow);
  };

  return {
    recordAdminAction,
    listRecentAdminActions,
  };
};
