import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export interface RoomItemRecord {
  id: string;
  roomId: string;
  catalogItemId: string;
  name: string;
  description: string;
  texture: string;
  tileX: number;
  tileY: number;
}

export interface InventoryItemRecord {
  id: string;
  userId: string;
  catalogItemId: string;
  roomItemId: string;
  name: string;
  description: string;
  texture: string;
  acquiredAt: Date;
}

export type ItemPickupErrorCode = 'not_found' | 'already_picked' | 'room_mismatch';

export interface ItemPickupSuccessResult {
  ok: true;
  roomItem: RoomItemRecord;
  inventoryItem: InventoryItemRecord;
}

export interface ItemPickupErrorResult {
  ok: false;
  code: ItemPickupErrorCode;
  roomItem?: RoomItemRecord;
}

export type ItemPickupResult = ItemPickupSuccessResult | ItemPickupErrorResult;

export interface ItemStore {
  listRoomItems(roomId: string): Promise<RoomItemRecord[]>;
  listInventoryByUser(userId: string): Promise<InventoryItemRecord[]>;
  pickupRoomItem(params: {
    roomItemId: string;
    roomId: string;
    userId: string;
  }): Promise<ItemPickupResult>;
}

const mapRoomItemRow = (row: {
  id: string;
  room_id: string;
  catalog_item_id: string;
  name: string;
  description: string;
  texture_path: string;
  x: number;
  y: number;
}): RoomItemRecord => ({
  id: row.id,
  roomId: row.room_id,
  catalogItemId: row.catalog_item_id,
  name: row.name,
  description: row.description,
  texture: row.texture_path,
  tileX: row.x,
  tileY: row.y,
});

const mapInventoryRow = (row: {
  id: string;
  user_id: string;
  catalog_item_id: string;
  room_item_id: string;
  name: string;
  description: string;
  texture_path: string;
  acquired_at: Date;
}): InventoryItemRecord => ({
  id: row.id,
  userId: row.user_id,
  catalogItemId: row.catalog_item_id,
  roomItemId: row.room_item_id,
  name: row.name,
  description: row.description,
  texture: row.texture_path,
  acquiredAt: row.acquired_at,
});

export const createItemStore = (pool: Pool): ItemStore => {
  const listRoomItems = async (roomId: string): Promise<RoomItemRecord[]> => {
    const result = await pool.query({
      text: `SELECT ri.id, ri.room_id, ri.catalog_item_id, ri.x, ri.y, ic.name, ic.description, ic.texture_path
               FROM room_item ri
               JOIN item_catalog ic ON ic.id = ri.catalog_item_id
              WHERE ri.room_id = $1 AND ri.picked_up_at IS NULL`,
      values: [roomId],
    });

    return result.rows.map(mapRoomItemRow);
  };

  const listInventoryByUser = async (userId: string): Promise<InventoryItemRecord[]> => {
    const result = await pool.query({
      text: `SELECT ii.id, ii.user_id, ii.catalog_item_id, ii.room_item_id, ii.acquired_at,
                    ic.name, ic.description, ic.texture_path
               FROM inventory_item ii
               JOIN item_catalog ic ON ic.id = ii.catalog_item_id
              WHERE ii.user_id = $1
              ORDER BY ii.acquired_at ASC, ii.id ASC`,
      values: [userId],
    });

    return result.rows.map(mapInventoryRow);
  };

  const pickupRoomItem = async ({
    roomItemId,
    roomId,
    userId,
  }: {
    roomItemId: string;
    roomId: string;
    userId: string;
  }): Promise<ItemPickupResult> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemResult = await client.query({
        text: `SELECT ri.id, ri.room_id, ri.catalog_item_id, ri.x, ri.y, ri.picked_up_at,
                      ic.name, ic.description, ic.texture_path
                 FROM room_item ri
                 JOIN item_catalog ic ON ic.id = ri.catalog_item_id
                WHERE ri.id = $1
                FOR UPDATE`,
        values: [roomItemId],
      });

      if (itemResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, code: 'not_found' };
      }

      const row = itemResult.rows[0];
      const roomItem = mapRoomItemRow(row);

      if (row.room_id !== roomId) {
        await client.query('ROLLBACK');
        return { ok: false, code: 'room_mismatch', roomItem };
      }

      if (row.picked_up_at) {
        await client.query('ROLLBACK');
        return { ok: false, code: 'already_picked', roomItem };
      }

      const updateResult = await client.query({
        text: `UPDATE room_item
                  SET picked_up_at = now(), picked_up_by = $2
                WHERE id = $1 AND picked_up_at IS NULL`,
        values: [roomItemId, userId],
      });

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, code: 'already_picked', roomItem };
      }

      await client.query({
        text: `INSERT INTO inventory_item (id, user_id, catalog_item_id, room_item_id)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (room_item_id) DO NOTHING`,
        values: [randomUUID(), userId, row.catalog_item_id, row.id],
      });

      const inventoryLookup = await client.query({
        text: `SELECT ii.id, ii.user_id, ii.catalog_item_id, ii.room_item_id, ii.acquired_at,
                      ic.name, ic.description, ic.texture_path
                 FROM inventory_item ii
                 JOIN item_catalog ic ON ic.id = ii.catalog_item_id
                WHERE ii.room_item_id = $1
                LIMIT 1`,
        values: [row.id],
      });

      if (inventoryLookup.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new Error(`Inventory record missing after pickup for item ${row.id}`);
      }

      await client.query('COMMIT');

      return {
        ok: true,
        roomItem,
        inventoryItem: mapInventoryRow(inventoryLookup.rows[0]),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  return {
    listRoomItems,
    listInventoryByUser,
    pickupRoomItem,
  };
};
