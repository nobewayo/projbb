// @module: client-realtime
// @tags: websocket, state, social

import type {
  ChatMessageBroadcast,
  ReportRecord,
  SocialMuteBroadcast,
  SocialReportBroadcast,
} from '@bitby/schemas';

export type SocialIgnoreEvent = { type: 'mute' | 'report'; receivedAt: number };

export const filterChatLogByMuted = (
  log: ChatMessageBroadcast[],
  mutedIds: ReadonlySet<string>,
  maxEntries: number = 200,
): ChatMessageBroadcast[] =>
  log
    .filter((entry) => !entry.userId || !mutedIds.has(entry.userId))
    .slice(-maxEntries);

type ReduceMuteParams = {
  broadcast: SocialMuteBroadcast;
  sessionUserId: string | null;
  mutedIds: Set<string>;
  chatLog: ChatMessageBroadcast[];
  now?: () => number;
};

export type SocialMuteReducerOutcome =
  | { kind: 'noop' }
  | { kind: 'ignored'; event: SocialIgnoreEvent }
  | {
      kind: 'applied';
      mutedOccupantIds: string[];
      chatLog: ChatMessageBroadcast[];
    };

export const reduceSocialMuteBroadcast = ({
  broadcast,
  sessionUserId,
  mutedIds,
  chatLog,
  now = Date.now,
}: ReduceMuteParams): SocialMuteReducerOutcome => {
  if (!sessionUserId) {
    return { kind: 'noop' };
  }

  if (broadcast.mute.userId !== sessionUserId) {
    return { kind: 'ignored', event: { type: 'mute', receivedAt: now() } };
  }

  mutedIds.add(broadcast.mute.mutedUserId);
  return {
    kind: 'applied',
    mutedOccupantIds: Array.from(mutedIds),
    chatLog: filterChatLogByMuted(chatLog, mutedIds),
  };
};

export const SOCIAL_REPORT_HISTORY_LIMIT = 50;

type ReduceReportParams = {
  broadcast: SocialReportBroadcast;
  sessionUserId: string | null;
  reportHistory: ReportRecord[];
  maxEntries?: number;
  now?: () => number;
};

export type SocialReportReducerOutcome =
  | { kind: 'noop' }
  | { kind: 'ignored'; event: SocialIgnoreEvent }
  | { kind: 'applied'; reportHistory: ReportRecord[] };

export const reduceSocialReportBroadcast = ({
  broadcast,
  sessionUserId,
  reportHistory,
  maxEntries = SOCIAL_REPORT_HISTORY_LIMIT,
  now = Date.now,
}: ReduceReportParams): SocialReportReducerOutcome => {
  if (!sessionUserId) {
    return { kind: 'noop' };
  }

  if (broadcast.report.reporterId !== sessionUserId) {
    return { kind: 'ignored', event: { type: 'report', receivedAt: now() } };
  }

  const nextHistory = [...reportHistory];
  const existingIndex = nextHistory.findIndex(
    (entry) => entry.id === broadcast.report.id,
  );

  if (existingIndex >= 0) {
    nextHistory[existingIndex] = broadcast.report;
  } else {
    nextHistory.unshift(broadcast.report);
    if (nextHistory.length > maxEntries) {
      nextHistory.length = maxEntries;
    }
  }

  return { kind: 'applied', reportHistory: nextHistory };
};

