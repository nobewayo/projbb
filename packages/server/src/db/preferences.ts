import type { Pool } from 'pg';

export interface ChatPreferenceRecord {
  userId: string;
  showSystemMessages: boolean;
}

export interface PreferenceStore {
  getChatPreferences(userId: string): Promise<ChatPreferenceRecord>;
  updateChatShowSystemMessages(
    userId: string,
    showSystemMessages: boolean,
  ): Promise<ChatPreferenceRecord>;
}

export const createPreferenceStore = (pool: Pool): PreferenceStore => {
  const getChatPreferences = async (
    userId: string,
  ): Promise<ChatPreferenceRecord> => {
    const result = await pool.query<{ show_system_messages: boolean }>(
      `SELECT show_system_messages
         FROM user_chat_preference
        WHERE user_id = $1`,
      [userId],
    );

    const showSystemMessages = result.rows[0]?.show_system_messages ?? true;
    return { userId, showSystemMessages };
  };

  const updateChatShowSystemMessages = async (
    userId: string,
    showSystemMessages: boolean,
  ): Promise<ChatPreferenceRecord> => {
    const result = await pool.query<{ show_system_messages: boolean }>(
      `INSERT INTO user_chat_preference (user_id, show_system_messages, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE
           SET show_system_messages = EXCLUDED.show_system_messages,
               updated_at = now()
       RETURNING show_system_messages`,
      [userId, showSystemMessages],
    );

    const persisted = result.rows[0]?.show_system_messages ?? showSystemMessages;
    return { userId, showSystemMessages: persisted };
  };

  return {
    getChatPreferences,
    updateChatShowSystemMessages,
  };
};
