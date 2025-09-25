import type { Pool, PoolClient } from 'pg';

interface Migration {
  id: string;
  statements: string[];
}

const MIGRATION_TABLE = 'schema_migration';
const DEV_ROOM_ID = '11111111-1111-1111-1111-111111111111';
const USER_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$F65uLJH6eRV81ypU4z3HRg$ZcuxQnFZWAVuEV+kW2TTN5JMcZIMkvYm6kgOOy2L6cg';

const USERS = [
  {
    id: '11111111-1111-1111-1111-111111111201',
    username: 'test',
    rolesSql: "ARRAY['user']",
  },
  {
    id: '11111111-1111-1111-1111-111111111202',
    username: 'test2',
    rolesSql: "ARRAY['user']",
  },
  {
    id: '11111111-1111-1111-1111-111111111203',
    username: 'test3',
    rolesSql: "ARRAY['user']",
  },
  {
    id: '11111111-1111-1111-1111-111111111204',
    username: 'test4',
    rolesSql: "ARRAY['user']",
  },
  {
    id: '11111111-1111-1111-1111-111111111299',
    username: 'npc-guide',
    rolesSql: "ARRAY['npc']",
  },
] as const;

const INITIAL_TILE_FLAGS = [
  { x: 2, y: 8, locked: false, noPickup: true },
  { x: 7, y: 3, locked: true, noPickup: false },
];

const INITIAL_ROOM_ITEMS = [
  {
    id: '11111111-1111-1111-1111-222222222201',
    name: 'Atrium Plant',
    description:
      'Lush greenery staged near the spawn tiles to verify z-ordering beneath avatars while ensuring pickup gating still works.',
    textureKey: 'plant',
    tileX: 6,
    tileY: 4,
  },
  {
    id: '11111111-1111-1111-1111-222222222202',
    name: 'Lounge Couch',
    description:
      'Soft seating reserved for plaza screenshots. This tile has pickup disabled so the right panel can surface the gating copy mandated by the spec.',
    textureKey: 'couch',
    tileX: 2,
    tileY: 8,
  },
];

const escapeSqlString = (value: string): string => value.replace(/'/g, "''");

const MIGRATIONS: Migration[] = [
  {
    id: '0001_initial',
    statements: [
      `CREATE TABLE IF NOT EXISTS app_user (
        id uuid PRIMARY KEY,
        username text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        roles text[] NOT NULL DEFAULT ARRAY[]::text[],
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS room (
        id uuid PRIMARY KEY,
        slug text UNIQUE NOT NULL,
        name text NOT NULL,
        room_seq bigint NOT NULL DEFAULT 1,
        created_at timestamptz DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS room_tile_flag (
        room_id uuid NOT NULL REFERENCES room(id) ON DELETE CASCADE,
        x integer NOT NULL,
        y integer NOT NULL,
        locked boolean NOT NULL DEFAULT false,
        no_pickup boolean NOT NULL DEFAULT false,
        PRIMARY KEY (room_id, x, y)
      )`,
      `CREATE TABLE IF NOT EXISTS room_avatar (
        user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
        room_id uuid REFERENCES room(id) ON DELETE SET NULL,
        x integer NOT NULL,
        y integer NOT NULL,
        updated_at timestamptz DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_room_avatar_room ON room_avatar(room_id)`,
      `CREATE TABLE IF NOT EXISTS chat_message (
        id uuid PRIMARY KEY,
        room_id uuid NOT NULL REFERENCES room(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        body text NOT NULL,
        created_at timestamptz DEFAULT now(),
        room_seq bigint NOT NULL DEFAULT 1
      )`,
      `CREATE INDEX IF NOT EXISTS idx_chat_message_room_ts ON chat_message(room_id, created_at, id)`
    ],
  },
  {
    id: '0002_seed_dev_room',
    statements: [
      `INSERT INTO room (id, slug, name, room_seq)
        VALUES ('${DEV_ROOM_ID}', 'dev-room', 'Development Plaza', 1)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      ...USERS.map(
        (user) =>
          `INSERT INTO app_user (id, username, password_hash, roles)
            VALUES ('${user.id}', '${user.username}', '${USER_PASSWORD_HASH}', ${user.rolesSql})
            ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, roles = EXCLUDED.roles`,
      ),
      ...INITIAL_TILE_FLAGS.map(
        (flag) =>
          `INSERT INTO room_tile_flag (room_id, x, y, locked, no_pickup)
            VALUES ('${DEV_ROOM_ID}', ${flag.x}, ${flag.y}, ${flag.locked}, ${flag.noPickup})
            ON CONFLICT (room_id, x, y) DO UPDATE SET locked = EXCLUDED.locked, no_pickup = EXCLUDED.no_pickup`,
      ),
      `INSERT INTO room_avatar (user_id, room_id, x, y)
         VALUES ('11111111-1111-1111-1111-111111111299', '${DEV_ROOM_ID}', 6, 4)
         ON CONFLICT (user_id) DO UPDATE SET room_id = EXCLUDED.room_id, x = EXCLUDED.x, y = EXCLUDED.y`,
    ],
  },
  {
    id: '0003_chat_sequence',
    statements: [
      `ALTER TABLE chat_message ADD COLUMN IF NOT EXISTS room_seq bigint NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS idx_chat_message_room_seq ON chat_message(room_id, room_seq)`
    ],
  },
  {
    id: '0004_room_items',
    statements: [
      `CREATE TABLE IF NOT EXISTS room_item (
        id uuid PRIMARY KEY,
        room_id uuid NOT NULL REFERENCES room(id) ON DELETE CASCADE,
        name text NOT NULL,
        description text NOT NULL,
        texture_key text NOT NULL,
        tile_x integer NOT NULL,
        tile_y integer NOT NULL,
        picked_up_at timestamptz,
        picked_up_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_room_item_room_available
         ON room_item(room_id)
         WHERE picked_up_at IS NULL`,
      `CREATE TABLE IF NOT EXISTS user_inventory_item (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
        room_item_id uuid NOT NULL REFERENCES room_item(id) ON DELETE CASCADE,
        room_id uuid NOT NULL REFERENCES room(id) ON DELETE CASCADE,
        acquired_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_inventory_unique
         ON user_inventory_item(user_id, room_item_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_inventory_user
         ON user_inventory_item(user_id)`,
      ...INITIAL_ROOM_ITEMS.map((item) =>
        `DELETE FROM user_inventory_item WHERE room_item_id = '${item.id}'`,
      ),
      ...INITIAL_ROOM_ITEMS.map(
        (item) =>
          `INSERT INTO room_item (id, room_id, name, description, texture_key, tile_x, tile_y, picked_up_at, picked_up_by)
            VALUES ('${item.id}', '${DEV_ROOM_ID}', '${escapeSqlString(item.name)}', '${escapeSqlString(item.description)}', '${escapeSqlString(item.textureKey)}', ${item.tileX}, ${item.tileY}, NULL, NULL)
            ON CONFLICT (id) DO UPDATE SET
              room_id = EXCLUDED.room_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              texture_key = EXCLUDED.texture_key,
              tile_x = EXCLUDED.tile_x,
              tile_y = EXCLUDED.tile_y,
              picked_up_at = NULL,
              picked_up_by = NULL,
              updated_at = now()`
      ),
    ],
  },
];

const ensureMigrationTable = async (pool: Pool): Promise<void> => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
};

const hasMigrationRun = async (client: PoolClient, id: string): Promise<boolean> => {
  const result = await client.query<{ id: string }>(
    `SELECT id FROM ${MIGRATION_TABLE} WHERE id = $1 LIMIT 1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
};

const recordMigration = async (client: PoolClient, id: string): Promise<void> => {
  await client.query(
    `INSERT INTO ${MIGRATION_TABLE} (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [id],
  );
};

export const runMigrations = async (pool: Pool): Promise<void> => {
  await ensureMigrationTable(pool);

  for (const migration of MIGRATIONS) {
    const client = await pool.connect();
    let inTransaction = false;
    try {
      const applied = await hasMigrationRun(client, migration.id);
      if (applied) {
        continue;
      }

      await client.query('BEGIN');
      inTransaction = true;
      for (const statement of migration.statements) {
        await client.query(statement);
      }
      await recordMigration(client, migration.id);
      await client.query('COMMIT');
      inTransaction = false;
    } catch (error) {
      if (inTransaction) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // eslint-disable-next-line no-console
          console.error('Failed to rollback migration', rollbackError);
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
};
