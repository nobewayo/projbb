// @module: server-auth-store
// @tags: auth, persistence, users

import argon2 from 'argon2';
import type { Pool } from 'pg';
import type { PublicUser, UserRecord } from './types.js';

export interface UserStore {
  findUserByUsername(username: string): Promise<UserRecord | null>;
  toPublicUser(user: UserRecord): PublicUser;
  verifyUserPassword(user: UserRecord, password: string): Promise<boolean>;
}

const normaliseUsername = (username: string): string => username.trim().toLowerCase();

export const createUserStore = (pool: Pool): UserStore => {
  const findUserByUsername = async (username: string): Promise<UserRecord | null> => {
    const result = await pool.query<{
      id: string;
      username: string;
      password_hash: string;
      roles: string[] | null;
    }>(
      `SELECT id, username, password_hash, roles
         FROM app_user
        WHERE lower(username) = $1
        LIMIT 1`,
      [normaliseUsername(username)],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      roles: Array.isArray(row.roles) ? row.roles : [],
    };
  };

  const toPublicUser = (user: UserRecord): PublicUser => ({
    id: user.id,
    username: user.username,
    roles: [...user.roles],
  });

  const verifyUserPassword = async (
    user: UserRecord,
    password: string,
  ): Promise<boolean> => {
    try {
      return await argon2.verify(user.passwordHash, password);
    } catch (error) {
      return false;
    }
  };

  return {
    findUserByUsername,
    toPublicUser,
    verifyUserPassword,
  };
};
