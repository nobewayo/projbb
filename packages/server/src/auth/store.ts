import argon2 from 'argon2';
import type { PublicUser, UserRecord } from './types.js';

const seededUsers: UserRecord[] = [
  {
    id: 'user-test',
    username: 'test',
    roles: ['user'],
    passwordHash:
      '$argon2id$v=19$m=65536,t=3,p=4$F65uLJH6eRV81ypU4z3HRg$ZcuxQnFZWAVuEV+kW2TTN5JMcZIMkvYm6kgOOy2L6cg',
  },
  {
    id: 'user-test2',
    username: 'test2',
    roles: ['user'],
    passwordHash:
      '$argon2id$v=19$m=65536,t=3,p=4$F65uLJH6eRV81ypU4z3HRg$ZcuxQnFZWAVuEV+kW2TTN5JMcZIMkvYm6kgOOy2L6cg',
  },
  {
    id: 'user-test3',
    username: 'test3',
    roles: ['user'],
    passwordHash:
      '$argon2id$v=19$m=65536,t=3,p=4$F65uLJH6eRV81ypU4z3HRg$ZcuxQnFZWAVuEV+kW2TTN5JMcZIMkvYm6kgOOy2L6cg',
  },
  {
    id: 'user-test4',
    username: 'test4',
    roles: ['user'],
    passwordHash:
      '$argon2id$v=19$m=65536,t=3,p=4$F65uLJH6eRV81ypU4z3HRg$ZcuxQnFZWAVuEV+kW2TTN5JMcZIMkvYm6kgOOy2L6cg',
  },
];

const usersByUsername = new Map<string, UserRecord>(
  seededUsers.map((user) => [user.username.toLowerCase(), user]),
);

const normalizeUsername = (username: string): string => username.trim().toLowerCase();

export const findUserByUsername = (username: string): UserRecord | null => {
  const normalized = normalizeUsername(username);
  return usersByUsername.get(normalized) ?? null;
};

export const verifyUserPassword = async (
  user: UserRecord,
  password: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(user.passwordHash, password);
  } catch (error) {
    return false;
  }
};

export const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  username: user.username,
  roles: [...user.roles],
});
