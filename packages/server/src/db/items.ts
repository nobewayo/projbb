import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface RoomItemRecord {
  id: string;
  roomId: string;
  name: string;
  description: string;
  textureKey: string;
  tileX: number;
  tileY: number;
  pickedUpAt: Date | null;
  pickedUpBy: string | null;
}

export interface InventoryItemRecord {
  id: string;
  userId: string;
  roomItemId: string;
  roomId: string;
  name: string;
  description: string;
  textureKey: string;
  acquiredAt: Date;
}

export type ItemPickupFailureReason =
  | 'not_found'
  | 'already_picked_up'
  | 'persist_failed';

export type ItemPickupResult =
  | { ok: true; item: RoomItemRecord; inventoryItem: InventoryItemRecord }
  | { ok: false; reason: ItemPickupFailureReason; item?: RoomItemRecord | null };

export interface ItemStore {
  listRoomItems(roomId: string): Promise<RoomItemRecord[]>;
  listInventoryForUser(userId: string): Promise<InventoryItemRecord[]>;
  attemptPickup(
    params: { itemId: string; userId: string; roomId: string },
  ): Promise<ItemPickupResult>;
  createRoomItem(params: {
    roomId: string;
    name: string;
    description: string;
    textureKey: string;
    tileX: number;
    tileY: number;
    id?: string;
  }): Promise<RoomItemRecord>;
}

const mapRoomItemRow = (row: {
  id: string;
  room_id: string;
  name: string;
  description: string;
  texture_key: string;
  tile_x: number;
  tile_y: number;
  picked_up_at: Date | string | null;
  picked_up_by: string | null;
}): RoomItemRecord => ({
  id: row.id,
  roomId: row.room_id,
  name: row.name,
  description: row.description,
  textureKey: row.texture_key,
  tileX: row.tile_x,
  tileY: row.tile_y,
  pickedUpAt: row.picked_up_at ? new Date(row.picked_up_at) : null,
  pickedUpBy: row.picked_up_by,
});

const mapInventoryRow = (row: {
  id: string;
  user_id: string;
  room_item_id: string;
  room_id: string;
  acquired_at: Date | string;
}): {
  id: string;
  userId: string;
  roomItemId: string;
  roomId: string;
  acquiredAt: Date;
} => ({
  id: row.id,
  userId: row.user_id,
  roomItemId: row.room_item_id,
  roomId: row.room_id,
  acquiredAt: new Date(row.acquired_at),
});

const withTransaction = async <T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // eslint-disable-next-line no-console
      console.error('Failed to rollback item transaction', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
};

export const createItemStore = (pool: Pool): ItemStore => {
  const listRoomItems = async (roomId: string): Promise<RoomItemRecord[]> => {
    const result = await pool.query<{
      id: string;
      room_id: string;
      name: string;
      description: string;
      texture_key: string;
      tile_x: number;
      tile_y: number;
      picked_up_at: Date | string | null;
      picked_up_by: string | null;
    }>(
      `SELECT id, room_id, name, description, texture_key, tile_x, tile_y, picked_up_at, picked_up_by
         FROM room_item
        WHERE room_id = $1 AND picked_up_at IS NULL
        ORDER BY tile_y ASC, tile_x ASC`,
      [roomId],
    );

    return result.rows.map((row) => mapRoomItemRow(row));
  };

  const listInventoryForUser = async (userId: string): Promise<InventoryItemRecord[]> => {
    const result = await pool.query<{
      id: string;
      user_id: string;
      room_item_id: string;
      room_id: string;
      acquired_at: Date | string;
      name: string;
      description: string;
      texture_key: string;
    }>(
      `SELECT uii.id, uii.user_id, uii.room_item_id, uii.room_id, uii.acquired_at,
              ri.name, ri.description, ri.texture_key
         FROM user_inventory_item uii
         JOIN room_item ri ON ri.id = uii.room_item_id
        WHERE uii.user_id = $1
        ORDER BY uii.acquired_at DESC, uii.id DESC`,
      [userId],
    );

    return result.rows.map((row) => ({
      ...mapInventoryRow(row),
      name: row.name,
      description: row.description,
      textureKey: row.texture_key,
    }));
  };

  const attemptPickup = async ({
    itemId,
    userId,
    roomId,
  }: {
    itemId: string;
    userId: string;
    roomId: string;
  }): Promise<ItemPickupResult> =>
    withTransaction(pool, async (client) => {
      const itemResult = await client.query<{
        id: string;
        room_id: string;
        name: string;
        description: string;
        texture_key: string;
        tile_x: number;
        tile_y: number;
        picked_up_at: Date | string | null;
        picked_up_by: string | null;
      }>(
        `SELECT id, room_id, name, description, texture_key, tile_x, tile_y, picked_up_at, picked_up_by
           FROM room_item
          WHERE id = $1
          FOR UPDATE`,
        [itemId],
      );

      if (itemResult.rowCount === 0) {
        return { ok: false, reason: 'not_found' };
      }

      const item = mapRoomItemRow(itemResult.rows[0]);
      if (item.roomId !== roomId) {
        return { ok: false, reason: 'not_found' };
      }

      if (item.pickedUpAt) {
        return { ok: false, reason: 'already_picked_up', item };
      }

      const updatedItemResult = await client.query<{
        id: string;
        room_id: string;
        name: string;
        description: string;
        texture_key: string;
        tile_x: number;
        tile_y: number;
        picked_up_at: Date | string | null;
        picked_up_by: string | null;
      }>(
        `UPDATE room_item
            SET picked_up_at = now(),
                picked_up_by = $2,
                updated_at = now()
          WHERE id = $1
          RETURNING id, room_id, name, description, texture_key, tile_x, tile_y, picked_up_at, picked_up_by`,
        [itemId, userId],
      );

      if (updatedItemResult.rowCount === 0) {
        return { ok: false, reason: 'persist_failed' };
      }

      const updatedItem = mapRoomItemRow(updatedItemResult.rows[0]);

      const inventoryId = randomUUID();
      const inventoryInsertResult = await client.query<{
        id: string;
        user_id: string;
        room_item_id: string;
        room_id: string;
        acquired_at: Date | string;
      }>(
        `INSERT INTO user_inventory_item (id, user_id, room_item_id, room_id)
             VALUES ($1, $2, $3, $4)
          RETURNING id, user_id, room_item_id, room_id, acquired_at`,
        [inventoryId, userId, updatedItem.id, updatedItem.roomId],
      );

      if (inventoryInsertResult.rowCount === 0) {
        return { ok: false, reason: 'persist_failed', item: updatedItem };
      }

      const inventoryBase = mapInventoryRow(inventoryInsertResult.rows[0]);

      const inventoryItem: InventoryItemRecord = {
        ...inventoryBase,
        name: updatedItem.name,
        description: updatedItem.description,
        textureKey: updatedItem.textureKey,
      };

      return { ok: true, item: updatedItem, inventoryItem };
    });

  const createRoomItem = async ({
    roomId,
    name,
    description,
    textureKey,
    tileX,
    tileY,
    id,
  }: {
    roomId: string;
    name: string;
    description: string;
    textureKey: string;
    tileX: number;
    tileY: number;
    id?: string;
  }): Promise<RoomItemRecord> => {
    const itemId = id ?? randomUUID();
    const result = await pool.query<{
      id: string;
      room_id: string;
      name: string;
      description: string;
      texture_key: string;
      tile_x: number;
      tile_y: number;
      picked_up_at: Date | string | null;
      picked_up_by: string | null;
    }>(
      `INSERT INTO room_item (id, room_id, name, description, texture_key, tile_x, tile_y, picked_up_at, picked_up_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL)
      RETURNING id, room_id, name, description, texture_key, tile_x, tile_y, picked_up_at, picked_up_by`,
      [itemId, roomId, name, description, textureKey, tileX, tileY],
    );

    if (result.rowCount === 0) {
      throw new Error('Failed to insert room item');
    }

    return mapRoomItemRow(result.rows[0]);
  };

  return {
    listRoomItems,
    listInventoryForUser,
    attemptPickup,
    createRoomItem,
  };
};
