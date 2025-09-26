import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io';
import {
  chatPreferenceUpdateDataSchema,
  chatPreferencesSchema,
  chatSendRequestDataSchema,
  chatTypingUpdateDataSchema,
  itemPickupRequestDataSchema,
  messageEnvelopeSchema,
  moveRequestDataSchema,
  adminAffordanceUpdateDataSchema,
  adminTileFlagUpdateDataSchema,
  adminLatencyTraceEventDataSchema,
  roomItemAddedDataSchema,
  socialMuteBroadcastSchema,
  socialReportBroadcastSchema,
  tradeLifecycleBroadcastSchema,
  tradeSessionSchema,
  tradeNegotiationStateSchema,
  type ChatMessageBroadcast,
  type ChatPreferences,
  type ChatTypingBroadcast,
  type MessageEnvelope,
  type MoveErrorCode,
  type AdminDevAffordanceState,
  type AdminLatencyTrace,
  type SocialMuteRecord,
  type SocialReportRecord,
  type TradeLifecycleBroadcast,
} from '@bitby/schemas';
import { z } from 'zod';
import type { ServerConfig } from '../config.js';
import { decodeToken } from '../auth/jwt.js';
import type { AuthenticatedUser, RoomSnapshot } from '../auth/types.js';
import type { RoomStore, TileFlagRecord } from '../db/rooms.js';
import type { ChatStore } from '../db/chat.js';
import type { RoomPubSub, RoomChatEvent } from '../redis/pubsub.js';
import type { MetricsBundle } from '../metrics/registry.js';
import type {
  ItemStore,
  InventoryItemRecord,
  RoomItemRecord,
} from '../db/items.js';
import type { PreferenceStore } from '../db/preferences.js';
import type { AdminStateStore, RoomAdminStateRecord } from '../db/admin.js';
import type {
  SocialStore,
  MuteRecord,
  ReportRecord,
  TradeSessionRecord,
  TradeProposalRecord,
} from '../db/social.js';
import { TRADE_MAX_SLOTS_PER_USER } from '../db/social.js';

const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_GRACE_MS = HEARTBEAT_INTERVAL_MS * 2;
const DEVELOPMENT_ROOM_SLUG = 'dev-room';
const TYPING_INDICATOR_TTL_MS = 6_000;
const CHAT_HISTORY_LIMIT = 200;

const GRID_ROW_COUNT = 10;
const EVEN_ROW_COLUMNS = 10;
const ODD_ROW_COLUMNS = 11;

const DEVELOPMENT_SPAWN_POINTS: Array<{ x: number; y: number }> = [
  { x: 5, y: 4 },
  { x: 5, y: 5 },
  { x: 4, y: 4 },
  { x: 5, y: 3 },
  { x: 6, y: 5 },
  { x: 4, y: 5 },
  { x: 6, y: 3 },
];

interface TileFlag extends TileFlagRecord {}

interface RegisteredConnection {
  socket: Socket;
  logger: FastifyBaseLogger;
  userId: string;
}

type SocialMutePayload = SocialMuteRecord;

type SocialReportPayload = SocialReportRecord;

type TradeLifecyclePayload = TradeLifecycleBroadcast['trade'];
type TradeNegotiationPayload = TradeLifecycleBroadcast['negotiation'];

interface UserSocialState {
  mutes: Map<string, SocialMutePayload>;
  reports: Map<string, SocialReportPayload>;
}

interface TradeParticipantSummary {
  id: string;
  username: string;
}

interface DevelopmentRoomState {
  id: string;
  name: string;
  roomSeq: number;
  tiles: TileFlag[];
  tileIndex: Map<string, TileFlag>;
  occupants: Map<string, RoomOccupant>;
  connections: Map<string, RegisteredConnection>;
  items: Map<string, RoomItem>;
  typingIndicators: Map<string, TypingIndicatorState>;
  adminState: RoomAdminStateRecord;
  socialState: Map<string, UserSocialState>;
}

interface RoomItem {
  id: string;
  name: string;
  description: string;
  textureKey: string;
  tileX: number;
  tileY: number;
}

interface RoomOccupant {
  id: string;
  username: string;
  roles: string[];
  position: { x: number; y: number };
}

interface TypingIndicatorState {
  userId: string;
  preview: string | null;
  expiresAt: number;
}

interface ConnectionContext {
  app: FastifyInstance;
  socket: Socket;
  requestId: string;
}

interface RealtimeDependencies {
  config: ServerConfig;
  roomStore: RoomStore;
  chatStore: ChatStore;
  itemStore: ItemStore;
  pubsub: RoomPubSub;
  metrics: MetricsBundle;
  preferenceStore: PreferenceStore;
  adminStateStore: AdminStateStore;
  socialStore: SocialStore;
}

export interface RealtimeServer {
  handleConnection(context: ConnectionContext): void;
  applyTileFlagUpdate(event: {
    tile: TileFlagRecord;
    roomSeq: number;
    updatedBy: string;
  }): Promise<void>;
  applyAffordanceUpdate(event: {
    state: AdminDevAffordanceState;
    updatedBy: string;
  }): Promise<void>;
  applyLatencyTrace(event: { trace: AdminLatencyTrace }): Promise<void>;
  applyItemSpawn(event: {
    item: RoomItemRecord;
    roomSeq: number;
    createdBy: string;
  }): Promise<void>;
  applyMuteRecord(event: { record: MuteRecord }): Promise<void>;
  applyReportRecord(event: { record: ReportRecord }): Promise<void>;
  applyTradeLifecycleUpdate(event: {
    trade: TradeSessionRecord;
    actorId: string;
  }): Promise<void>;
  shutdown(): Promise<void>;
}

type EnvelopeData = Record<string, unknown>;

type Envelope = MessageEnvelope<EnvelopeData>;

type AuthOkPayload = EnvelopeData & {
  user: AuthenticatedUser;
  room: {
    id: string;
    name: string;
  };
  heartbeatIntervalMs: number;
  roomSnapshot: RoomSnapshot;
  chatHistory: ChatMessageBroadcast[];
  inventory: InventoryItemPayload[];
  typingIndicators: ChatTypingBroadcast[];
  chatPreferences: ChatPreferences;
  social: {
    mutes: SocialMutePayload[];
    reports: SocialReportPayload[];
  };
  tradeLifecycle: TradeLifecycleBroadcast | null;
};

interface InventoryItemPayload {
  id: string;
  roomItemId: string;
  roomId: string;
  name: string;
  description: string;
  textureKey: string;
  acquiredAt: string;
}

const authPayloadSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

const createTileKey = (x: number, y: number): string => `${x},${y}`;

const getColumnsForRow = (row: number): number =>
  row % 2 === 0 ? EVEN_ROW_COLUMNS : ODD_ROW_COLUMNS;

const toUnixTimestamp = () => Math.floor(Date.now() / 1000);

const createEnvelope = (op: string, seq: number, data: EnvelopeData = {}): Envelope => ({
  op,
  seq,
  ts: toUnixTimestamp(),
  data,
});

const toRoomItem = (record: RoomItemRecord): RoomItem => ({
  id: record.id,
  name: record.name,
  description: record.description,
  textureKey: record.textureKey,
  tileX: record.tileX,
  tileY: record.tileY,
});

const toInventoryPayload = (record: InventoryItemRecord): InventoryItemPayload => ({
  id: record.id,
  roomItemId: record.roomItemId,
  roomId: record.roomId,
  name: record.name,
  description: record.description,
  textureKey: record.textureKey,
  acquiredAt: record.acquiredAt.toISOString(),
});

const toMutePayload = (record: MuteRecord): SocialMutePayload => ({
  id: record.id,
  userId: record.userId,
  mutedUserId: record.mutedUserId,
  roomId: record.roomId,
  createdAt: record.createdAt.toISOString(),
});

const toReportPayload = (record: ReportRecord): SocialReportPayload => ({
  id: record.id,
  reporterId: record.reporterId,
  reportedUserId: record.reportedUserId,
  roomId: record.roomId,
  reason: record.reason,
  createdAt: record.createdAt.toISOString(),
});

const toTradePayload = (record: TradeSessionRecord): TradeLifecyclePayload => ({
  id: record.id,
  initiatorId: record.initiatorId,
  recipientId: record.recipientId,
  roomId: record.roomId,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
  acceptedAt: record.acceptedAt?.toISOString(),
  completedAt: record.completedAt?.toISOString(),
  cancelledAt: record.cancelledAt?.toISOString(),
  cancelledBy: record.cancelledBy ?? undefined,
  cancelledReason: record.cancelledReason ?? undefined,
  initiatorReady: record.initiatorReady,
  recipientReady: record.recipientReady,
});

const toTradeProposalPayload = (record: TradeProposalRecord) => ({
  slotIndex: record.slotIndex,
  offeredBy: record.offeredBy,
  updatedAt: record.updatedAt.toISOString(),
  item: {
    inventoryItemId: record.inventoryItemId,
    roomItemId: record.roomItemId,
    name: record.name,
    description: record.description,
    textureKey: record.textureKey,
  },
});

const cloneOccupant = (occupant: RoomOccupant): RoomOccupant => ({
  id: occupant.id,
  username: occupant.username,
  roles: [...occupant.roles],
  position: { x: occupant.position.x, y: occupant.position.y },
});

const cloneItem = (item: RoomItem): RoomItem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  textureKey: item.textureKey,
  tileX: item.tileX,
  tileY: item.tileY,
});

const sortOccupants = (map: Map<string, RoomOccupant>): RoomOccupant[] =>
  Array.from(map.values())
    .map((occupant) => cloneOccupant(occupant))
    .sort((a, b) => {
      if (a.position.y === b.position.y) {
        return a.position.x - b.position.x;
      }

      return a.position.y - b.position.y;
    });

const sortItems = (map: Map<string, RoomItem>): RoomItem[] =>
  Array.from(map.values())
    .map((item) => cloneItem(item))
    .sort((a, b) => {
      if (a.tileY === b.tileY) {
        return a.tileX - b.tileX;
      }

      return a.tileY - b.tileY;
    });

const safeSend = (
  logger: FastifyBaseLogger,
  socket: Socket,
  envelope: Envelope,
): void => {
  try {
    socket.emit('message', envelope);
  } catch (error) {
    logger.error({ err: error }, 'Failed to send websocket envelope');
  }
};

const acknowledge = (
  logger: FastifyBaseLogger,
  socket: Socket,
  requestEnvelope: Envelope,
  op: string,
  data: EnvelopeData = {},
): void => {
  safeSend(logger, socket, createEnvelope(op, requestEnvelope.seq, data));
};

const emitSystemMessage = (
  logger: FastifyBaseLogger,
  socket: Socket,
  op: string,
  data: EnvelopeData,
): void => {
  safeSend(logger, socket, createEnvelope(op, 0, data));
};

export const createRealtimeServer = async ({
  config,
  roomStore,
  chatStore,
  itemStore,
  pubsub,
  metrics,
  preferenceStore,
  adminStateStore,
  socialStore,
}: RealtimeDependencies): Promise<RealtimeServer> => {
  const roomRecord = await roomStore.getRoomBySlug(DEVELOPMENT_ROOM_SLUG);
  if (!roomRecord) {
    throw new Error('Development room is missing from the database');
  }

  const tileFlags = await roomStore.getTileFlags(roomRecord.id);
  const occupantList = await roomStore.listOccupants(roomRecord.id);
  const roomItems = await itemStore.listRoomItems(roomRecord.id);

  const adminStateRecord = await adminStateStore.getRoomState(roomRecord.id);

  const developmentRoomState: DevelopmentRoomState = {
    id: roomRecord.id,
    name: roomRecord.name,
    roomSeq: roomRecord.roomSeq,
    tiles: tileFlags,
    tileIndex: new Map(tileFlags.map((flag) => [createTileKey(flag.x, flag.y), flag])),
    occupants: new Map(),
    connections: new Map(),
    items: new Map(roomItems.map((record) => [record.id, toRoomItem(record)])),
    typingIndicators: new Map(),
    adminState: adminStateRecord,
    socialState: new Map(),
  };

  for (const occupant of occupantList) {
    developmentRoomState.occupants.set(occupant.id, cloneOccupant(occupant));
  }

  const updateRoomSeq = (roomSeq: number): void => {
    if (roomSeq > developmentRoomState.roomSeq) {
      developmentRoomState.roomSeq = roomSeq;
    }
  };

  const getOrCreateSocialState = (userId: string): UserSocialState => {
    let state = developmentRoomState.socialState.get(userId);
    if (!state) {
      state = { mutes: new Map(), reports: new Map() } satisfies UserSocialState;
      developmentRoomState.socialState.set(userId, state);
    }
    return state;
  };

  const serialiseSocialState = (userId: string): {
    mutes: SocialMutePayload[];
    reports: SocialReportPayload[];
  } => {
    const state = getOrCreateSocialState(userId);
    return {
      mutes: Array.from(state.mutes.values()),
      reports: Array.from(state.reports.values()),
    };
  };

  const refreshSocialStateForUser = async (userId: string) => {
    const [mutes, reports] = await Promise.all([
      socialStore.listMutesForUser(userId),
      socialStore.listReportsByUser(userId),
    ]);
    const state = getOrCreateSocialState(userId);
    state.mutes.clear();
    state.reports.clear();
    for (const record of mutes) {
      const payload = toMutePayload(record);
      state.mutes.set(payload.mutedUserId, payload);
    }
    for (const record of reports) {
      const payload = toReportPayload(record);
      state.reports.set(payload.id, payload);
    }
    return serialiseSocialState(userId);
  };

  const resolveTradeParticipantForUser = async (params: {
    trade: TradeLifecyclePayload;
    requesterId: string;
  }): Promise<TradeParticipantSummary> => {
    const { trade, requesterId } = params;
    const otherUserId =
      trade.initiatorId === requesterId ? trade.recipientId : trade.initiatorId;

    const connected = developmentRoomState.occupants.get(otherUserId);
    if (connected) {
      return { id: connected.id, username: connected.username };
    }

    const occupantRecord = await roomStore.getOccupant(otherUserId);
    if (occupantRecord && occupantRecord.username.length > 0) {
      return { id: occupantRecord.id, username: occupantRecord.username };
    }

    const profile = await socialStore.getUserProfile(otherUserId);
    if (profile) {
      return { id: profile.id, username: profile.username };
    }

    return { id: otherUserId, username: 'Unknown occupant' };
  };

  const buildTradeNegotiationPayload = async (
    tradeId: string,
  ): Promise<TradeNegotiationPayload> => {
    const proposals = await socialStore.listTradeProposalsForTrade(tradeId);
    return {
      proposals: proposals.map((proposal) => toTradeProposalPayload(proposal)),
      maxSlotsPerUser: TRADE_MAX_SLOTS_PER_USER,
    } satisfies TradeNegotiationPayload;
  };

  const hydrateTradeLifecycleForUser = async (
    userId: string,
  ): Promise<TradeLifecycleBroadcast | null> => {
    const record = await socialStore.getLatestTradeSessionForUser(userId);
    if (!record) {
      return null;
    }

    const tradePayload = toTradePayload(record);
    const participant = await resolveTradeParticipantForUser({
      trade: tradePayload,
      requesterId: userId,
    });

    const negotiation = await buildTradeNegotiationPayload(tradePayload.id);

    return tradeLifecycleBroadcastSchema.parse({
      trade: tradePayload,
      participant,
      negotiation,
    });
  };

  const serialiseAdminState = (): {
    affordances: AdminDevAffordanceState;
    lastLatencyTrace: AdminLatencyTrace | null;
  } => ({
    affordances: { ...developmentRoomState.adminState.affordances },
    lastLatencyTrace: developmentRoomState.adminState.lastLatencyTrace
      ? {
          traceId: developmentRoomState.adminState.lastLatencyTrace.traceId,
          requestedAt: developmentRoomState.adminState.lastLatencyTrace.requestedAt.toISOString(),
          requestedBy:
            developmentRoomState.adminState.lastLatencyTrace.requestedBy ?? 'system',
        }
      : null,
  });

  const buildSnapshot = (): RoomSnapshot => ({
    id: developmentRoomState.id,
    name: developmentRoomState.name,
    roomSeq: developmentRoomState.roomSeq,
    occupants: sortOccupants(developmentRoomState.occupants),
    tiles: developmentRoomState.tiles.map((tile) => ({
      x: tile.x,
      y: tile.y,
      locked: tile.locked,
      noPickup: tile.noPickup,
    })),
    items: sortItems(developmentRoomState.items),
    adminState: serialiseAdminState(),
  });

  const isTileLocked = (x: number, y: number): boolean =>
    developmentRoomState.tileIndex.get(createTileKey(x, y))?.locked ?? false;

  const isTileInBounds = (x: number, y: number): boolean => {
    if (y < 0 || y >= GRID_ROW_COUNT || x < 0) {
      return false;
    }

    const columns = getColumnsForRow(y);
    return x < columns;
  };

  const isTileOccupied = (x: number, y: number, excludeUserId?: string): boolean => {
    for (const occupant of developmentRoomState.occupants.values()) {
      if (occupant.id === excludeUserId) {
        continue;
      }

      if (occupant.position.x === x && occupant.position.y === y) {
        return true;
      }
    }

    return false;
  };

  const findAvailableSpawn = (): { x: number; y: number } => {
    for (const candidate of DEVELOPMENT_SPAWN_POINTS) {
      if (isTileLocked(candidate.x, candidate.y)) {
        continue;
      }

      if (!isTileOccupied(candidate.x, candidate.y)) {
        return { ...candidate };
      }
    }

    return { x: 5, y: 4 };
  };

  const ensureOccupant = async (
    user: AuthenticatedUser,
  ): Promise<{ occupant: RoomOccupant; wasNew: boolean }> => {
    const existing = developmentRoomState.occupants.get(user.id);
    if (existing) {
      existing.username = user.username;
      existing.roles = [...user.roles];
      return { occupant: existing, wasNew: false };
    }

    const fromStore = await roomStore.getOccupant(user.id);
    if (fromStore && fromStore.roomId === developmentRoomState.id) {
      const occupant: RoomOccupant = {
        id: fromStore.id,
        username: user.username,
        roles: [...user.roles],
        position: { ...fromStore.position },
      };
      developmentRoomState.occupants.set(user.id, occupant);
      return { occupant, wasNew: false };
    }

    const spawn = findAvailableSpawn();
    const created = await roomStore.upsertOccupantPosition(user.id, developmentRoomState.id, spawn);
    const occupant: RoomOccupant = {
      id: created.id,
      username: user.username,
      roles: [...user.roles],
      position: { ...created.position },
    };
    developmentRoomState.occupants.set(user.id, occupant);

    const newRoomSeq = await roomStore.incrementRoomSequence(developmentRoomState.id);
    updateRoomSeq(newRoomSeq);

    return { occupant, wasNew: true };
  };

  const registerConnection = async (
    logger: FastifyBaseLogger,
    socket: Socket,
    user: AuthenticatedUser,
  ): Promise<{
    snapshot: RoomSnapshot;
    occupant: RoomOccupant;
    inventory: InventoryItemRecord[];
    social: { mutes: SocialMutePayload[]; reports: SocialReportPayload[] };
    tradeLifecycle: TradeLifecycleBroadcast | null;
  }> => {
    const { occupant } = await ensureOccupant(user);
    developmentRoomState.connections.set(socket.id, { socket, logger, userId: user.id });

    const inventory = await itemStore.listInventoryForUser(user.id);
    const social = await refreshSocialStateForUser(user.id);
    const tradeLifecycle = await hydrateTradeLifecycleForUser(user.id);

    return {
      snapshot: buildSnapshot(),
      occupant,
      inventory,
      social,
      tradeLifecycle,
    };
  };

  const emitSocialMuteUpdate = (payload: SocialMutePayload): void => {
    for (const connection of developmentRoomState.connections.values()) {
      if (connection.userId !== payload.userId) {
        continue;
      }

      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('social:mute:recorded', 0, { mute: payload }),
      );
    }
  };

  const emitSocialReportUpdate = (payload: SocialReportPayload): void => {
    for (const connection of developmentRoomState.connections.values()) {
      if (connection.userId !== payload.reporterId) {
        continue;
      }

      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('social:report:recorded', 0, { report: payload }),
      );
    }
  };

  const emitTradeLifecycleUpdate = async (event: {
    trade: TradeLifecyclePayload;
    negotiation: TradeNegotiationPayload;
    actorId?: string;
  }): Promise<void> => {
    const { trade, negotiation, actorId } = event;
    const recipients = new Map<string, TradeParticipantSummary>();
    const targetUserIds = [trade.initiatorId, trade.recipientId];

    for (const userId of targetUserIds) {
      if (recipients.has(userId)) {
        continue;
      }
      const participant = await resolveTradeParticipantForUser({
        trade,
        requesterId: userId,
      });
      recipients.set(userId, participant);
    }

    for (const connection of developmentRoomState.connections.values()) {
      const participant = recipients.get(connection.userId);
      if (!participant) {
        continue;
      }

      const payload = tradeLifecycleBroadcastSchema.parse({
        trade,
        participant,
        negotiation,
        actorId: actorId ?? undefined,
      });
      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('trade:lifecycle:update', 0, payload),
      );
    }
  };

  const unregisterConnection = async (socket: Socket): Promise<void> => {
    const connection = developmentRoomState.connections.get(socket.id);
    if (!connection) {
      return;
    }

    developmentRoomState.connections.delete(socket.id);

    if (developmentRoomState.typingIndicators.has(connection.userId)) {
      clearTypingIndicator(connection.userId);
      const payload: ChatTypingBroadcast = { userId: connection.userId, isTyping: false };
      broadcastTypingEvent(payload, socket.id);
      await pubsub.publish({
        type: 'chat:typing',
        roomId: developmentRoomState.id,
        payload,
      });
    }

    const occupant = developmentRoomState.occupants.get(connection.userId);
    if (!occupant) {
      return;
    }

    developmentRoomState.occupants.delete(connection.userId);
    await roomStore.clearOccupant(connection.userId);
    const newRoomSeq = await roomStore.incrementRoomSequence(developmentRoomState.id);
    updateRoomSeq(newRoomSeq);

    for (const other of developmentRoomState.connections.values()) {
      safeSend(
        other.logger,
        other.socket,
        createEnvelope('room:occupant_left', 0, {
          occupantId: occupant.id,
          lastPosition: { ...occupant.position },
          roomSeq: developmentRoomState.roomSeq,
        }),
      );
    }
  };

  const broadcastOccupantMove = (
    occupant: RoomOccupant,
    roomSeq: number,
    excludeSocketId?: string,
  ): void => {
    for (const connection of developmentRoomState.connections.values()) {
      if (excludeSocketId && connection.socket.id === excludeSocketId) {
        continue;
      }

      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('room:occupant_moved', 0, {
          occupant: cloneOccupant(occupant),
          roomSeq,
        }),
      );
    }
  };

  const broadcastItemRemoved = (
    itemId: string,
    roomSeq: number,
    excludeSocketId?: string,
  ): void => {
    for (const connection of developmentRoomState.connections.values()) {
      if (excludeSocketId && connection.socket.id === excludeSocketId) {
        continue;
      }

      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('room:item_removed', 0, {
          itemId,
          roomSeq,
        }),
      );
    }
  };

  const broadcastItemAdded = (
    item: RoomItem,
    roomSeq: number,
    excludeSocketId?: string,
  ): void => {
    const payload = roomItemAddedDataSchema.parse({
      item: cloneItem(item),
      roomSeq,
    });

    for (const connection of developmentRoomState.connections.values()) {
      if (excludeSocketId && connection.socket.id === excludeSocketId) {
        continue;
      }

      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('room:item_added', 0, payload),
      );
    }
  };

  const pruneTypingIndicators = (now: number = Date.now()): void => {
    for (const indicator of developmentRoomState.typingIndicators.values()) {
      if (indicator.expiresAt <= now) {
        developmentRoomState.typingIndicators.delete(indicator.userId);
      }
    }
  };

  const serialiseTypingIndicators = (): ChatTypingBroadcast[] => {
    pruneTypingIndicators();
    return Array.from(developmentRoomState.typingIndicators.values()).map(
      (indicator) => ({
        userId: indicator.userId,
        isTyping: true,
        preview: indicator.preview ?? undefined,
        expiresAt: new Date(indicator.expiresAt).toISOString(),
      }),
    );
  };

  const broadcastTypingEvent = (
    payload: ChatTypingBroadcast,
    excludeSocketId?: string,
  ): void => {
    for (const connection of developmentRoomState.connections.values()) {
      if (excludeSocketId && connection.socket.id === excludeSocketId) {
        continue;
      }

      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('chat:typing', 0, payload),
      );
    }
  };

  const setTypingIndicator = (
    userId: string,
    preview: string | null,
  ): TypingIndicatorState => {
    pruneTypingIndicators();
    const text = preview && preview.trim().length > 0 ? preview.trim().slice(0, 120) : null;
    const indicator: TypingIndicatorState = {
      userId,
      preview: text,
      expiresAt: Date.now() + TYPING_INDICATOR_TTL_MS,
    };
    developmentRoomState.typingIndicators.set(userId, indicator);
    return indicator;
  };

  const clearTypingIndicator = (userId: string): void => {
    developmentRoomState.typingIndicators.delete(userId);
  };

  const broadcastChatEvent = (event: RoomChatEvent): void => {
    if (event.type === 'chat:new') {
      updateRoomSeq(event.payload.roomSeq);
      clearTypingIndicator(event.payload.userId);
      for (const connection of developmentRoomState.connections.values()) {
        safeSend(
          connection.logger,
          connection.socket,
          createEnvelope('chat:new', 0, event.payload),
        );
      }
      return;
    }

    if (event.type === 'chat:typing') {
      if (event.payload.isTyping) {
        const indicator = setTypingIndicator(event.payload.userId, event.payload.preview ?? null);
        const serialised: ChatTypingBroadcast = {
          userId: indicator.userId,
          isTyping: true,
          preview: indicator.preview ?? undefined,
          expiresAt: new Date(indicator.expiresAt).toISOString(),
        };
        broadcastTypingEvent(serialised);
      } else {
        clearTypingIndicator(event.payload.userId);
        broadcastTypingEvent({ userId: event.payload.userId, isTyping: false });
      }
    }
  };

  const broadcastTileFlagUpdate = (
    tile: TileFlagRecord,
    roomSeq: number,
    updatedBy: string,
  ): void => {
    const payload = adminTileFlagUpdateDataSchema.parse({
      tile: { x: tile.x, y: tile.y, locked: tile.locked, noPickup: tile.noPickup },
      roomSeq,
      updatedBy,
    });
    for (const connection of developmentRoomState.connections.values()) {
      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('admin:tile_flag:update', 0, payload),
      );
    }
  };

  const broadcastAffordanceUpdate = (
    state: AdminDevAffordanceState,
    updatedBy: string,
  ): void => {
    const payload = adminAffordanceUpdateDataSchema.parse({
      state,
      updatedBy,
    });
    for (const connection of developmentRoomState.connections.values()) {
      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('admin:affordance:update', 0, payload),
      );
    }
  };

  const broadcastLatencyTrace = (trace: AdminLatencyTrace): void => {
    const payload = adminLatencyTraceEventDataSchema.parse({ trace });
    for (const connection of developmentRoomState.connections.values()) {
      safeSend(
        connection.logger,
        connection.socket,
        createEnvelope('admin:latency:trace', 0, payload),
      );
    }
  };

  const applyTileFlagUpdateInternal = async (
    event: { tile: TileFlagRecord; roomSeq: number; updatedBy: string },
    shouldPublish: boolean,
  ): Promise<void> => {
    const { tile, roomSeq, updatedBy } = event;
    const key = createTileKey(tile.x, tile.y);
    developmentRoomState.tileIndex.set(key, { ...tile });
    const existingIndex = developmentRoomState.tiles.findIndex(
      (candidate) => candidate.x === tile.x && candidate.y === tile.y,
    );
    if (existingIndex >= 0) {
      developmentRoomState.tiles[existingIndex] = { ...tile };
    } else {
      developmentRoomState.tiles.push({ ...tile });
    }

    updateRoomSeq(roomSeq);
    broadcastTileFlagUpdate(tile, roomSeq, updatedBy);

    if (shouldPublish) {
      await pubsub.publish({
        type: 'admin:tile_flag:update',
        roomId: developmentRoomState.id,
        payload: { tile, roomSeq, updatedBy },
      });
    }
  };

  const applyAffordanceUpdateInternal = async (
    event: { state: AdminDevAffordanceState; updatedBy: string },
    shouldPublish: boolean,
  ): Promise<void> => {
    developmentRoomState.adminState = {
      ...developmentRoomState.adminState,
      affordances: { ...event.state },
    };

    broadcastAffordanceUpdate(event.state, event.updatedBy);

    if (shouldPublish) {
      await pubsub.publish({
        type: 'admin:affordance:update',
        roomId: developmentRoomState.id,
        payload: { state: event.state, updatedBy: event.updatedBy },
      });
    }
  };

  const applyLatencyTraceInternal = async (
    event: { trace: AdminLatencyTrace },
    shouldPublish: boolean,
  ): Promise<void> => {
    const requestedAt = new Date(event.trace.requestedAt);
    const safeRequestedAt = Number.isNaN(requestedAt.getTime())
      ? new Date()
      : requestedAt;

    developmentRoomState.adminState = {
      ...developmentRoomState.adminState,
      lastLatencyTrace: {
        traceId: event.trace.traceId,
        requestedAt: safeRequestedAt,
        requestedBy: event.trace.requestedBy,
      },
    };

    broadcastLatencyTrace({ ...event.trace, requestedAt: safeRequestedAt.toISOString() });

    if (shouldPublish) {
      await pubsub.publish({
        type: 'admin:latency:trace',
        roomId: developmentRoomState.id,
        payload: {
          traceId: event.trace.traceId,
          requestedAt: safeRequestedAt.toISOString(),
          requestedBy: event.trace.requestedBy,
        },
      });
    }
  };

  const applyItemSpawnInternal = async (
    event: { item: RoomItemRecord; roomSeq: number; createdBy: string },
    shouldPublish: boolean,
  ): Promise<void> => {
    const item = toRoomItem(event.item);
    developmentRoomState.items.set(item.id, { ...item });

    updateRoomSeq(event.roomSeq);
    broadcastItemAdded(item, developmentRoomState.roomSeq);

    if (shouldPublish) {
      await pubsub.publish({
        type: 'room:item:added',
        roomId: developmentRoomState.id,
        payload: event,
      });
    }
  };

  const applyMuteRecordInternal = async (
    event: { mute: SocialMutePayload },
    shouldPublish: boolean,
  ): Promise<void> => {
    const state = getOrCreateSocialState(event.mute.userId);
    state.mutes.set(event.mute.mutedUserId, event.mute);
    emitSocialMuteUpdate(event.mute);

    if (shouldPublish) {
      await pubsub.publish({
        type: 'social:mute:recorded',
        roomId: developmentRoomState.id,
        payload: { mute: event.mute },
      });
    }
  };

  const applyReportRecordInternal = async (
    event: { report: SocialReportPayload },
    shouldPublish: boolean,
  ): Promise<void> => {
    const state = getOrCreateSocialState(event.report.reporterId);
    state.reports.set(event.report.id, event.report);
    emitSocialReportUpdate(event.report);

    if (shouldPublish) {
      await pubsub.publish({
        type: 'social:report:recorded',
        roomId: developmentRoomState.id,
        payload: { report: event.report },
      });
    }
  };

  const applyTradeLifecycleInternal = async (
    event: { trade: TradeLifecyclePayload; negotiation: TradeNegotiationPayload; actorId?: string },
    shouldPublish: boolean,
  ): Promise<void> => {
    await emitTradeLifecycleUpdate({
      trade: event.trade,
      negotiation: event.negotiation,
      actorId: event.actorId,
    });

    if (shouldPublish) {
      await pubsub.publish({
        type: 'trade:lifecycle:update',
        roomId: developmentRoomState.id,
        payload: { trade: event.trade, negotiation: event.negotiation, actorId: event.actorId },
      });
    }
  };

  await pubsub.subscribe(developmentRoomState.id, (event) => {
    if (event.type === 'chat:new' || event.type === 'chat:typing') {
      if (event.type === 'chat:new') {
        metrics.chatEvents.inc();
      }
      broadcastChatEvent(event);
      return;
    }

    if (event.type === 'admin:tile_flag:update') {
      void applyTileFlagUpdateInternal(event.payload, false).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote tile flag update', error);
      });
      return;
    }

    if (event.type === 'admin:affordance:update') {
      void applyAffordanceUpdateInternal(event.payload, false).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote affordance update', error);
      });
      return;
    }

    if (event.type === 'admin:latency:trace') {
      void applyLatencyTraceInternal({ trace: event.payload }, false).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote latency trace update', error);
      });
      return;
    }

    if (event.type === 'room:item:added') {
      void applyItemSpawnInternal(event.payload, false).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote item spawn', error);
      });
      return;
    }

    if (event.type === 'social:mute:recorded') {
      const parsed = socialMuteBroadcastSchema.safeParse(event.payload);
      if (!parsed.success) {
        // eslint-disable-next-line no-console
        console.error('Received malformed social mute event payload');
        return;
      }
      void applyMuteRecordInternal({ mute: parsed.data.mute }, false).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote social mute', error);
      });
      return;
    }

    if (event.type === 'social:report:recorded') {
      const parsed = socialReportBroadcastSchema.safeParse(event.payload);
      if (!parsed.success) {
        // eslint-disable-next-line no-console
        console.error('Received malformed social report event payload');
        return;
      }
      void applyReportRecordInternal({ report: parsed.data.report }, false).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote social report', error);
      });
      return;
    }

    if (event.type === 'trade:lifecycle:update') {
      const tradeResult = tradeSessionSchema.safeParse(event.payload.trade);
      const negotiationResult = tradeNegotiationStateSchema.safeParse(event.payload.negotiation);
      if (!tradeResult.success || !negotiationResult.success) {
        // eslint-disable-next-line no-console
        console.error('Received malformed trade lifecycle payload');
        return;
      }
      void applyTradeLifecycleInternal(
        { trade: tradeResult.data, negotiation: negotiationResult.data, actorId: event.payload.actorId },
        false,
      ).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to apply remote trade lifecycle event', error);
      });
    }
  });

  const attemptMove = async (
    userId: string,
    target: { x: number; y: number },
  ): Promise<
    | {
        ok: true;
        occupant: RoomOccupant;
        roomSeq: number;
      }
    | {
        ok: false;
        code: MoveErrorCode;
        message: string;
        current: { x: number; y: number };
        roomSeq: number;
      }
  > => {
    const occupant = developmentRoomState.occupants.get(userId);
    if (!occupant) {
      return {
        ok: false,
        code: 'not_in_room',
        message: 'User is not registered in the room',
        current: { x: 0, y: 0 },
        roomSeq: developmentRoomState.roomSeq,
      };
    }

    const currentPosition = { ...occupant.position };

    if (!isTileInBounds(target.x, target.y)) {
      return {
        ok: false,
        code: 'invalid_tile',
        message: 'Target tile is outside the playable field',
        current: currentPosition,
        roomSeq: developmentRoomState.roomSeq,
      };
    }

    if (isTileLocked(target.x, target.y)) {
      return {
        ok: false,
        code: 'locked_tile',
        message: 'Target tile is locked',
        current: currentPosition,
        roomSeq: developmentRoomState.roomSeq,
      };
    }

    if (isTileOccupied(target.x, target.y, userId)) {
      return {
        ok: false,
        code: 'occupied',
        message: 'Target tile is currently occupied',
        current: currentPosition,
        roomSeq: developmentRoomState.roomSeq,
      };
    }

    if (currentPosition.x === target.x && currentPosition.y === target.y) {
      return {
        ok: true,
        occupant: cloneOccupant(occupant),
        roomSeq: developmentRoomState.roomSeq,
      };
    }

    occupant.position = { ...target };
    await roomStore.upsertOccupantPosition(userId, developmentRoomState.id, target);
    const newRoomSeq = await roomStore.incrementRoomSequence(developmentRoomState.id);
    updateRoomSeq(newRoomSeq);

    return {
      ok: true,
      occupant: cloneOccupant(occupant),
      roomSeq: developmentRoomState.roomSeq,
    };
  };

  const handleAuth = async (
    logger: FastifyBaseLogger,
    socket: Socket,
    envelope: Envelope,
    closeWithReason: (reason: string) => void,
  ): Promise<AuthenticatedUser | null> => {
    const parsed = authPayloadSchema.safeParse(envelope.data);
    if (!parsed.success) {
      acknowledge(logger, socket, envelope, 'error:auth_invalid', {
        message: 'Invalid auth payload',
        issues: parsed.error.issues,
      });
      return null;
    }

    let authenticatedUser: AuthenticatedUser;
    try {
      authenticatedUser = decodeToken(parsed.data.token, config);
    } catch (error) {
      logger.warn({ err: error }, 'Rejected realtime auth token');
      acknowledge(logger, socket, envelope, 'error:auth_invalid', {
        message: 'Authentication failed: invalid token',
      });
      closeWithReason('Invalid auth token');
      return null;
    }

    const { snapshot, inventory, social, tradeLifecycle } = await registerConnection(
      logger,
      socket,
      authenticatedUser,
    );
    const chatHistoryRecords = await chatStore.listRecentMessages(
      developmentRoomState.id,
      CHAT_HISTORY_LIMIT,
    );
    const preferenceRecord = await preferenceStore.getChatPreferences(
      authenticatedUser.id,
    );
    const chatPreferences = chatPreferencesSchema.parse({
      showSystemMessages: preferenceRecord.showSystemMessages,
    });

    const payload: AuthOkPayload = {
      user: authenticatedUser,
      room: {
        id: snapshot.id,
        name: snapshot.name,
      },
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      roomSnapshot: snapshot,
      chatHistory: chatHistoryRecords.map((record) => ({
        id: record.id,
        userId: record.userId,
        username: record.username,
        roles: record.roles,
        body: record.body,
        createdAt: record.createdAt.toISOString(),
        roomSeq: record.roomSeq,
      })),
      inventory: inventory.map((item) => toInventoryPayload(item)),
      typingIndicators: serialiseTypingIndicators(),
      chatPreferences,
      social,
      tradeLifecycle,
    };

    acknowledge(logger, socket, envelope, 'auth:ok', payload);

    const occupant = developmentRoomState.occupants.get(authenticatedUser.id);
    if (occupant) {
      broadcastOccupantMove(occupant, developmentRoomState.roomSeq, socket.id);
    }

    emitSystemMessage(logger, socket, 'system:room_snapshot', {
      message: 'Authoritative snapshot streaming is stubbed; using development fixtures.',
      roomSeq: snapshot.roomSeq,
      occupants: snapshot.occupants,
    });

    return authenticatedUser;
  };

  const handleChatSend = async (
    logger: FastifyBaseLogger,
    socket: Socket,
    envelope: Envelope,
    user: AuthenticatedUser,
  ): Promise<void> => {
    const parsed = chatSendRequestDataSchema.safeParse(envelope.data);
    if (!parsed.success) {
      acknowledge(logger, socket, envelope, 'error:chat_payload', {
        message: 'Invalid chat payload',
        issues: parsed.error.issues,
      });
      return;
    }

    const body = parsed.data.body.trim();
    if (body.length === 0) {
      acknowledge(logger, socket, envelope, 'error:chat_payload', {
        message: 'Chat message body cannot be empty',
      });
      return;
    }

    const newRoomSeq = await roomStore.incrementRoomSequence(developmentRoomState.id);
    updateRoomSeq(newRoomSeq);

    const record = await chatStore.createMessage({
      id: randomUUID(),
      roomId: developmentRoomState.id,
      userId: user.id,
      body,
      roomSeq: developmentRoomState.roomSeq,
    });

    const event: RoomChatEvent = {
      type: 'chat:new',
      roomId: developmentRoomState.id,
      payload: {
        id: record.id,
        userId: record.userId,
        username: record.username,
        roles: record.roles,
        body: record.body,
        createdAt: record.createdAt.toISOString(),
        roomSeq: record.roomSeq,
      },
    };

    metrics.chatEvents.inc();
    broadcastChatEvent(event);
    await pubsub.publish(event);

    try {
      await chatStore.pruneMessagesForRoom({
        roomId: developmentRoomState.id,
        retain: CHAT_HISTORY_LIMIT,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to prune chat history for room');
    }

    acknowledge(logger, socket, envelope, 'chat:ok', {
      messageId: record.id,
    });
  };

  const handleTypingUpdate = async (
    logger: FastifyBaseLogger,
    socket: Socket,
    envelope: Envelope,
    user: AuthenticatedUser,
  ): Promise<void> => {
    const parsed = chatTypingUpdateDataSchema.safeParse(envelope.data);
    if (!parsed.success) {
      acknowledge(logger, socket, envelope, 'error:chat_typing_payload', {
        message: 'Invalid typing payload',
        issues: parsed.error.issues,
      });
      return;
    }

    if (parsed.data.isTyping) {
      const indicator = setTypingIndicator(user.id, parsed.data.preview ?? null);
      const payload: ChatTypingBroadcast = {
        userId: indicator.userId,
        isTyping: true,
        preview: indicator.preview ?? undefined,
        expiresAt: new Date(indicator.expiresAt).toISOString(),
      };
      broadcastTypingEvent(payload, socket.id);
      const event: RoomChatEvent = {
        type: 'chat:typing',
        roomId: developmentRoomState.id,
        payload,
      };
      await pubsub.publish(event);
      acknowledge(logger, socket, envelope, 'chat:typing:ok', {
        isTyping: true,
        expiresAt: payload.expiresAt,
      });
      return;
    }

    clearTypingIndicator(user.id);
    const payload: ChatTypingBroadcast = { userId: user.id, isTyping: false };
    broadcastTypingEvent(payload, socket.id);
    await pubsub.publish({
      type: 'chat:typing',
      roomId: developmentRoomState.id,
      payload,
    });
    acknowledge(logger, socket, envelope, 'chat:typing:ok', {
      isTyping: false,
    });
  };

  const handleChatPreferenceUpdate = async (
    logger: FastifyBaseLogger,
    socket: Socket,
    envelope: Envelope,
    user: AuthenticatedUser,
  ): Promise<void> => {
    const parsed = chatPreferenceUpdateDataSchema.safeParse(envelope.data);
    if (!parsed.success) {
      acknowledge(logger, socket, envelope, 'error:chat_preferences_payload', {
        message: 'Invalid chat preference payload',
        issues: parsed.error.issues,
      });
      return;
    }

    try {
      const record = await preferenceStore.updateChatShowSystemMessages(
        user.id,
        parsed.data.showSystemMessages,
      );
      const preferences = chatPreferencesSchema.parse({
        showSystemMessages: record.showSystemMessages,
      });
      acknowledge(logger, socket, envelope, 'chat:preferences:ok', preferences);
    } catch (error) {
      logger.error({ err: error }, 'Failed to persist chat preferences');
      acknowledge(logger, socket, envelope, 'chat:preferences:err', {
        message: 'Failed to update chat preferences',
      });
    }
  };

  const handleItemPickup = async (
    logger: FastifyBaseLogger,
    socket: Socket,
    envelope: Envelope,
    user: AuthenticatedUser,
  ): Promise<void> => {
    const candidateItemId =
      typeof (envelope.data as { itemId?: unknown })?.itemId === 'string'
        ? ((envelope.data as { itemId: string }).itemId ?? 'unknown')
        : 'unknown';

    const sendError = (
      code:
        | 'validation_failed'
        | 'not_in_room'
        | 'not_found'
        | 'tile_blocked'
        | 'not_on_tile'
        | 'already_picked_up'
        | 'persist_failed',
      message: string,
      itemId: string,
    ): void => {
      acknowledge(logger, socket, envelope, 'item:pickup:err', {
        itemId,
        roomSeq: developmentRoomState.roomSeq,
        code,
        message,
      });
    };

    const parsed = itemPickupRequestDataSchema.safeParse(envelope.data);
    if (!parsed.success) {
      sendError('validation_failed', 'Ugyldig anmodning om pickup.', candidateItemId);
      return;
    }

    const itemId = parsed.data.itemId;
    const occupant = developmentRoomState.occupants.get(user.id);
    if (!occupant) {
      sendError('not_in_room', 'Du er ikke registreret i dette rum.', itemId);
      return;
    }

    const item = developmentRoomState.items.get(itemId);
    if (!item) {
      sendError('not_found', 'Genstanden findes ikke længere.', itemId);
      return;
    }

    if (occupant.position.x !== item.tileX || occupant.position.y !== item.tileY) {
      sendError('not_on_tile', 'Stil dig på feltet for at samle op.', itemId);
      return;
    }

    const tile = developmentRoomState.tileIndex.get(createTileKey(item.tileX, item.tileY));
    if (tile?.noPickup) {
      sendError('tile_blocked', 'Kan ikke samle op her.', itemId);
      return;
    }

    let result;
    try {
      result = await itemStore.attemptPickup({
        itemId,
        userId: user.id,
        roomId: developmentRoomState.id,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to persist item pickup');
      sendError('persist_failed', 'Kunne ikke gemme din genstand. Prøv igen.', itemId);
      return;
    }

    if (!result.ok) {
      if (result.reason === 'already_picked_up' || result.reason === 'not_found') {
        developmentRoomState.items.delete(itemId);
      }

      const message =
        result.reason === 'already_picked_up'
          ? 'Genstanden er allerede samlet op.'
          : result.reason === 'not_found'
            ? 'Genstanden findes ikke længere.'
            : 'Kunne ikke gemme din genstand. Prøv igen.';

      const code =
        result.reason === 'already_picked_up'
          ? 'already_picked_up'
          : result.reason === 'not_found'
            ? 'not_found'
            : 'persist_failed';

      sendError(code, message, itemId);
      return;
    }

    developmentRoomState.items.delete(itemId);
    const newRoomSeq = await roomStore.incrementRoomSequence(developmentRoomState.id);
    updateRoomSeq(newRoomSeq);

    metrics.itemPickups.inc();

    acknowledge(logger, socket, envelope, 'item:pickup:ok', {
      itemId,
      roomSeq: developmentRoomState.roomSeq,
      inventoryItem: toInventoryPayload(result.inventoryItem),
    });

    broadcastItemRemoved(itemId, developmentRoomState.roomSeq, socket.id);
  };

  const handleConnection = ({ app, socket, requestId }: ConnectionContext): void => {
    const logger = app.log.child({ scope: 'ws', requestId });
    metrics.activeConnections.inc();

    let isAuthenticated = false;
    let sessionUser: AuthenticatedUser | null = null;
    let lastHeartbeatAt = Date.now();

    const closeWithReason = (reason: string): void => {
      try {
        logger.warn({ reason }, 'Disconnecting realtime socket');
        if (socket.connected) {
          socket.disconnect(true);
        }
      } catch (error) {
        logger.error({ err: error }, 'Failed to close websocket connection gracefully');
      }
    };

    const heartbeatMonitor = setInterval(() => {
      const elapsed = Date.now() - lastHeartbeatAt;
      if (elapsed > HEARTBEAT_GRACE_MS) {
        logger.warn({ elapsed }, 'Heartbeat window elapsed; closing connection');
        closeWithReason('Heartbeat timeout');
      }
    }, HEARTBEAT_INTERVAL_MS);

    socket.on('message', (raw: unknown) => {
      void (async () => {
        let candidate: unknown = raw;

        if (typeof raw === 'string') {
          try {
            candidate = JSON.parse(raw);
          } catch (error) {
            logger.warn({ err: error }, 'Received invalid JSON payload');
            safeSend(
              logger,
              socket,
              createEnvelope('error:invalid_json', 0, {
                message: 'Messages must be valid JSON',
              }),
            );
            closeWithReason('Invalid JSON payload');
            return;
          }
        }

        const envelopeResult = messageEnvelopeSchema.safeParse(candidate);
        if (!envelopeResult.success) {
          logger.warn({ issues: envelopeResult.error.issues }, 'Received malformed envelope');
          safeSend(
            logger,
            socket,
            createEnvelope('error:envelope', 0, {
              message: 'Malformed envelope',
              issues: envelopeResult.error.issues,
            }),
          );
          return;
        }

        const envelope = envelopeResult.data;
        lastHeartbeatAt = Date.now();

        switch (envelope.op) {
          case 'ping': {
            acknowledge(logger, socket, envelope, 'pong', {
              serverTs: toUnixTimestamp(),
            });
            return;
          }
          case 'auth': {
            if (isAuthenticated) {
              acknowledge(logger, socket, envelope, 'error:auth_state', {
                message: 'Auth already completed for this session',
              });
              return;
            }

            const user = await handleAuth(logger, socket, envelope, closeWithReason);
            if (user) {
              isAuthenticated = true;
              sessionUser = user;
              lastHeartbeatAt = Date.now();
              logger.info({ userId: user.id }, 'Client authenticated');
            }
            return;
          }
          case 'move': {
            if (!isAuthenticated || !sessionUser) {
              acknowledge(logger, socket, envelope, 'error:not_authenticated', {
                message: 'Authenticate before issuing realtime operations',
              });
              return;
            }

            const payloadResult = moveRequestDataSchema.safeParse(envelope.data);
            if (!payloadResult.success) {
              acknowledge(logger, socket, envelope, 'error:move_payload', {
                message: 'Invalid move payload',
                issues: payloadResult.error.issues,
              });
              return;
            }

            const target = payloadResult.data;
            const moveResult = await attemptMove(sessionUser.id, target);

            if (moveResult.ok) {
              metrics.moveEvents.inc();
              acknowledge(logger, socket, envelope, 'move:ok', {
                x: moveResult.occupant.position.x,
                y: moveResult.occupant.position.y,
                roomSeq: moveResult.roomSeq,
              });
              broadcastOccupantMove(moveResult.occupant, moveResult.roomSeq, socket.id);
              logger.info(
                {
                  userId: sessionUser.id,
                  x: moveResult.occupant.position.x,
                  y: moveResult.occupant.position.y,
                  roomSeq: moveResult.roomSeq,
                },
                'Processed move operation',
              );
            } else {
              acknowledge(logger, socket, envelope, 'move:err', {
                code: moveResult.code,
                message: moveResult.message,
                at: target,
                current: moveResult.current,
                roomSeq: moveResult.roomSeq,
              });
              logger.warn(
                {
                  userId: sessionUser.id,
                  target,
                  code: moveResult.code,
                },
                'Rejected move operation',
              );
            }
            return;
          }
          case 'chat:send': {
            if (!isAuthenticated || !sessionUser) {
              acknowledge(logger, socket, envelope, 'error:not_authenticated', {
                message: 'Authenticate before issuing realtime operations',
              });
              return;
            }

            await handleChatSend(logger, socket, envelope, sessionUser);
            return;
          }
          case 'chat:typing': {
            if (!isAuthenticated || !sessionUser) {
              acknowledge(logger, socket, envelope, 'error:not_authenticated', {
                message: 'Authenticate before issuing realtime operations',
              });
              return;
            }

            await handleTypingUpdate(logger, socket, envelope, sessionUser);
            return;
          }
          case 'chat:preferences:update': {
            if (!isAuthenticated || !sessionUser) {
              acknowledge(logger, socket, envelope, 'error:not_authenticated', {
                message: 'Authenticate before issuing realtime operations',
              });
              return;
            }

            await handleChatPreferenceUpdate(logger, socket, envelope, sessionUser);
            return;
          }
          case 'item:pickup': {
            if (!isAuthenticated || !sessionUser) {
              const candidateItemId =
                typeof (envelope.data as { itemId?: unknown })?.itemId === 'string'
                  ? ((envelope.data as { itemId: string }).itemId ?? 'unknown')
                  : 'unknown';
              acknowledge(logger, socket, envelope, 'item:pickup:err', {
                itemId: candidateItemId,
                roomSeq: developmentRoomState.roomSeq,
                code: 'validation_failed',
                message: 'Authenticate before issuing realtime operations',
              });
              return;
            }

            await handleItemPickup(logger, socket, envelope, sessionUser);
            return;
          }
          default: {
            if (!isAuthenticated) {
              acknowledge(logger, socket, envelope, 'error:not_authenticated', {
                message: 'Authenticate before issuing realtime operations',
              });
              return;
            }

            acknowledge(logger, socket, envelope, 'error:unhandled_op', {
              message: `Operation ${envelope.op} is not yet implemented`,
            });
          }
        }
      })().catch((error: unknown) => {
        logger.error({ err: error }, 'Unhandled error while processing realtime message');
      });
    });

    socket.on('disconnect', (reason: string) => {
      clearInterval(heartbeatMonitor);
      metrics.activeConnections.dec();
      void unregisterConnection(socket).catch((error) => {
        logger.error({ err: error }, 'Failed to unregister realtime connection');
      });
      logger.info({ reason, userId: sessionUser?.id ?? null }, 'Socket.IO connection closed');
    });

    socket.on('error', (error: Error) => {
      logger.error({ err: error }, 'Socket.IO transport error');
    });

    emitSystemMessage(logger, socket, 'system:hello', {
      message: 'Authenticate via { op: "auth" } to start streaming realtime state.',
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    });
  };

  const applyTileFlagUpdate = async (event: {
    tile: TileFlagRecord;
    roomSeq: number;
    updatedBy: string;
  }): Promise<void> => {
    await applyTileFlagUpdateInternal(event, true);
  };

  const applyAffordanceUpdate = async (event: {
    state: AdminDevAffordanceState;
    updatedBy: string;
  }): Promise<void> => {
    await applyAffordanceUpdateInternal(event, true);
  };

  const applyLatencyTrace = async (event: { trace: AdminLatencyTrace }): Promise<void> => {
    await applyLatencyTraceInternal(event, true);
  };

  const applyItemSpawn = async (event: {
    item: RoomItemRecord;
    roomSeq: number;
    createdBy: string;
  }): Promise<void> => {
    await applyItemSpawnInternal(event, true);
  };

  const applyMuteRecord = async (event: { record: MuteRecord }): Promise<void> => {
    const payload = toMutePayload(event.record);
    await applyMuteRecordInternal({ mute: payload }, true);
  };

  const applyReportRecord = async (event: { record: ReportRecord }): Promise<void> => {
    const payload = toReportPayload(event.record);
    await applyReportRecordInternal({ report: payload }, true);
  };

  const applyTradeLifecycleUpdate = async (event: {
    trade: TradeSessionRecord;
    actorId: string;
  }): Promise<void> => {
    const payload = toTradePayload(event.trade);
    const negotiation = await buildTradeNegotiationPayload(event.trade.id);
    await applyTradeLifecycleInternal(
      { trade: payload, negotiation, actorId: event.actorId },
      true,
    );
  };

  const shutdown = async (): Promise<void> => {
    for (const connection of developmentRoomState.connections.values()) {
      try {
        connection.socket.disconnect(true);
      } catch (error) {
        connection.logger.error({ err: error }, 'Error while closing realtime socket');
      }
    }
    developmentRoomState.connections.clear();
  };

  return {
    handleConnection,
    applyTileFlagUpdate,
    applyAffordanceUpdate,
    applyLatencyTrace,
    applyItemSpawn,
    applyMuteRecord,
    applyReportRecord,
    applyTradeLifecycleUpdate,
    shutdown,
  };
};
