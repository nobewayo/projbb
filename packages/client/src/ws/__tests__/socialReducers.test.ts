// @module: client-realtime-tests
// @tags: websocket, state, social, tests

import { describe, expect, it } from 'vitest';
import type {
  ChatMessageBroadcast,
  ReportRecord,
  SocialMuteBroadcast,
  SocialReportBroadcast,
} from '@bitby/schemas';
import {
  filterChatLogByMuted,
  reduceSocialMuteBroadcast,
  reduceSocialReportBroadcast,
} from '../socialReducers';

const buildChatMessage = (overrides: Partial<ChatMessageBroadcast> = {}): ChatMessageBroadcast => ({
  id: overrides.id ?? crypto.randomUUID(),
  userId: overrides.userId ?? 'user-1',
  username: overrides.username ?? 'User One',
  roles: overrides.roles ?? [],
  body: overrides.body ?? 'Hello there',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  roomSeq: overrides.roomSeq ?? 1,
});

const buildMuteBroadcast = (overrides: Partial<SocialMuteBroadcast['mute']> = {}): SocialMuteBroadcast => ({
  mute: {
    id: overrides.id ?? crypto.randomUUID(),
    userId: overrides.userId ?? 'moderator-1',
    mutedUserId: overrides.mutedUserId ?? 'muted-user',
    roomId: overrides.roomId ?? 'room-1',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  },
});

const buildReportBroadcast = (
  overrides: Partial<SocialReportBroadcast['report']> = {},
): SocialReportBroadcast => ({
  report: {
    id: overrides.id ?? crypto.randomUUID(),
    reporterId: overrides.reporterId ?? 'moderator-1',
    reportedUserId: overrides.reportedUserId ?? 'user-2',
    roomId: overrides.roomId ?? 'room-1',
    reason: overrides.reason ?? 'spam',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  },
});

describe('filterChatLogByMuted', () => {
  it('removes muted user messages', () => {
    const mutedIds = new Set(['muted-user']);
    const log: ChatMessageBroadcast[] = Array.from({ length: 205 }, (_, index) =>
      buildChatMessage({
        id: `message-${index + 1}`,
        userId: index % 2 === 0 ? 'muted-user' : `user-${index}`,
        roomSeq: index + 1,
      }),
    );

    const filtered = filterChatLogByMuted(log, mutedIds);

    expect(filtered).toHaveLength(102);
    expect(filtered.every((entry) => entry.userId !== 'muted-user')).toBe(true);
    expect(filtered[0].id).toBe('message-2');
    expect(filtered.at(-1)?.id).toBe('message-204');
  });

  it('limits the retained messages to the last 200 entries', () => {
    const log: ChatMessageBroadcast[] = Array.from({ length: 250 }, (_, index) =>
      buildChatMessage({ id: `message-${index + 1}`, userId: `user-${index}`, roomSeq: index + 1 }),
    );

    const filtered = filterChatLogByMuted(log, new Set());

    expect(filtered).toHaveLength(200);
    expect(filtered[0].id).toBe('message-51');
    expect(filtered.at(-1)?.id).toBe('message-250');
  });
});

describe('reduceSocialMuteBroadcast', () => {
  it('returns noop when no session user is present', () => {
    const broadcast = buildMuteBroadcast();
    const outcome = reduceSocialMuteBroadcast({
      broadcast,
      sessionUserId: null,
      mutedIds: new Set(),
      chatLog: [],
      now: () => 10,
    });

    expect(outcome).toEqual({ kind: 'noop' });
  });

  it('returns ignored when the mute targets another player', () => {
    const broadcast = buildMuteBroadcast({ userId: 'moderator-2' });
    const outcome = reduceSocialMuteBroadcast({
      broadcast,
      sessionUserId: 'moderator-1',
      mutedIds: new Set(),
      chatLog: [],
      now: () => 42,
    });

    expect(outcome).toEqual({
      kind: 'ignored',
      event: { type: 'mute', receivedAt: 42 },
    });
  });

  it('adds the muted user and filters the chat log for the current moderator', () => {
    const broadcast = buildMuteBroadcast({ userId: 'moderator-1', mutedUserId: 'muted-user' });
    const mutedIds = new Set<string>();
    const chatLog = [
      buildChatMessage({ id: 'message-1', userId: 'muted-user', roomSeq: 1 }),
      buildChatMessage({ id: 'message-2', userId: 'friend', roomSeq: 2 }),
    ];

    const outcome = reduceSocialMuteBroadcast({
      broadcast,
      sessionUserId: 'moderator-1',
      mutedIds,
      chatLog,
      now: () => 90,
    });

    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') {
      return;
    }

    expect(outcome.mutedOccupantIds).toEqual(['muted-user']);
    expect(outcome.chatLog).toEqual([chatLog[1]]);
  });
});

describe('reduceSocialReportBroadcast', () => {
  it('returns noop when no session user is available', () => {
    const broadcast = buildReportBroadcast();
    const outcome = reduceSocialReportBroadcast({
      broadcast,
      sessionUserId: null,
      reportHistory: [],
      now: () => 77,
    });

    expect(outcome).toEqual({ kind: 'noop' });
  });

  it('returns ignored when the report originates from another moderator', () => {
    const broadcast = buildReportBroadcast({ reporterId: 'moderator-2' });
    const outcome = reduceSocialReportBroadcast({
      broadcast,
      sessionUserId: 'moderator-1',
      reportHistory: [],
      now: () => 64,
    });

    expect(outcome).toEqual({
      kind: 'ignored',
      event: { type: 'report', receivedAt: 64 },
    });
  });

  it('upserts the report history and enforces the size limit', () => {
    const existing: ReportRecord[] = [
      {
        id: 'report-1',
        reporterId: 'moderator-1',
        reportedUserId: 'user-5',
        roomId: 'room-1',
        reason: 'spam',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'report-2',
        reporterId: 'moderator-1',
        reportedUserId: 'user-6',
        roomId: 'room-1',
        reason: 'abuse',
        createdAt: new Date().toISOString(),
      },
    ];

    const broadcast = buildReportBroadcast({ id: 'report-3' });
    const outcome = reduceSocialReportBroadcast({
      broadcast,
      sessionUserId: 'moderator-1',
      reportHistory: existing,
      maxEntries: 2,
      now: () => 100,
    });

    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') {
      return;
    }

    expect(outcome.reportHistory.map((entry) => entry.id)).toEqual(['report-3', 'report-1']);
  });

  it('replaces an existing report when the identifiers match', () => {
    const existing: ReportRecord[] = [
      {
        id: 'report-1',
        reporterId: 'moderator-1',
        reportedUserId: 'user-5',
        roomId: 'room-1',
        reason: 'spam',
        createdAt: new Date().toISOString(),
      },
    ];

    const broadcast = buildReportBroadcast({ id: 'report-1', reason: 'updated' });
    const outcome = reduceSocialReportBroadcast({
      broadcast,
      sessionUserId: 'moderator-1',
      reportHistory: existing,
      now: () => 120,
    });

    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') {
      return;
    }

    expect(outcome.reportHistory).toHaveLength(1);
    expect(outcome.reportHistory[0].reason).toBe('updated');
  });
});

