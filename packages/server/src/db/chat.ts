import type { Pool } from 'pg';

export interface ChatMessageRecord {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  roles: string[];
  body: string;
  createdAt: Date;
  roomSeq: number;
}

export interface ChatStore {
  createMessage(
    input: {
      id: string;
      roomId: string;
      userId: string;
      body: string;
      roomSeq: number;
    },
  ): Promise<ChatMessageRecord>;
  listRecentMessages(roomId: string, limit: number): Promise<ChatMessageRecord[]>;
}

const mapRow = (row: {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  roles: string[] | null;
  body: string;
  created_at: Date;
  room_seq: string | number;
}): ChatMessageRecord => ({
  id: row.id,
  roomId: row.room_id,
  userId: row.user_id,
  username: row.username,
  roles: Array.isArray(row.roles) ? row.roles : [],
  body: row.body,
  createdAt: new Date(row.created_at),
  roomSeq: typeof row.room_seq === 'number' ? row.room_seq : Number.parseInt(row.room_seq, 10),
});

export const createChatStore = (pool: Pool): ChatStore => {
  const createMessage = async ({
    id,
    roomId,
    userId,
    body,
    roomSeq,
  }: {
    id: string;
    roomId: string;
    userId: string;
    body: string;
    roomSeq: number;
  }): Promise<ChatMessageRecord> => {
    const result = await pool.query<{
      id: string;
      room_id: string;
      user_id: string;
      body: string;
      created_at: Date;
      username: string;
      roles: string[] | null;
      room_seq: string | number;
    }>(
      `INSERT INTO chat_message (id, room_id, user_id, body, room_seq)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, room_id, user_id, body, created_at, room_seq,
                   (SELECT username FROM app_user WHERE id = chat_message.user_id) AS username,
                   (SELECT roles FROM app_user WHERE id = chat_message.user_id) AS roles`,
      [id, roomId, userId, body, roomSeq],
    );

    return mapRow(result.rows[0]);
  };

  const listRecentMessages = async (
    roomId: string,
    limit: number,
  ): Promise<ChatMessageRecord[]> => {
    const result = await pool.query<{
      id: string;
      room_id: string;
      user_id: string;
      body: string;
      created_at: Date;
      username: string;
      roles: string[] | null;
      room_seq: string | number;
    }>(
      `SELECT cm.id, cm.room_id, cm.user_id, cm.body, cm.created_at, cm.room_seq, au.username, au.roles
         FROM chat_message cm
         JOIN app_user au ON au.id = cm.user_id
        WHERE cm.room_id = $1
        ORDER BY cm.room_seq DESC, cm.id DESC
        LIMIT $2`,
      [roomId, limit],
    );

    return result.rows.map((row) => mapRow(row)).reverse();
  };

  return {
    createMessage,
    listRecentMessages,
  };
};
