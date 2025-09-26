import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  chatPreferenceUpdateDataSchema,
  chatPreferencesSchema,
  chatMessageBroadcastSchema,
  chatTypingBroadcastSchema,
  chatTypingUpdateDataSchema,
  inventoryItemSchema,
  itemPickupErrorDataSchema,
  itemPickupOkDataSchema,
  itemPickupRequestDataSchema,
  messageEnvelopeSchema,
  moveErrorDataSchema,
  moveOkDataSchema,
  moveRequestDataSchema,
  roomOccupantMovedDataSchema,
  roomOccupantLeftDataSchema,
  roomItemRemovedDataSchema,
  roomItemAddedDataSchema,
  roomSnapshotSchema,
  adminAffordanceUpdateDataSchema,
  adminTileFlagUpdateDataSchema,
  adminLatencyTraceEventDataSchema,
  occupantProfileResponseSchema,
  tradeBootstrapResponseSchema,
  muteResponseSchema,
  reportResponseSchema,
  type ChatMessageBroadcast,
  type ChatPreferences,
  type InventoryItem,
  type MessageEnvelope,
  type RoomOccupant,
  type RoomItem,
  type RoomTileFlag,
  type AdminState,
  type AdminDevAffordanceState,
  type OccupantProfile,
  type TradeBootstrapResponse,
  type MuteResponse,
  type ReportResponse,
} from '@bitby/schemas';

const DEFAULT_HEARTBEAT_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const LOGIN_USERNAME_FALLBACK = 'test';
const LOGIN_PASSWORD_FALLBACK = 'password123';
const TYPING_TTL_MS = 6_000;
const CHAT_BUBBLE_TTL_MS = 7_000;
const DEFAULT_ADMIN_STATE: AdminState = {
  affordances: {
    gridVisible: true,
    showHoverWhenGridHidden: true,
    moveAnimationsEnabled: true,
  },
  lastLatencyTrace: null,
};

const sortRoomItems = (items: Iterable<RoomItem>): RoomItem[] =>
  Array.from(items).sort((a, b) => {
    if (a.tileY === b.tileY) {
      return a.tileX - b.tileX;
    }
    return a.tileY - b.tileY;
  });

const sortInventoryItems = (items: Iterable<InventoryItem>): InventoryItem[] =>
  Array.from(items).sort((a, b) => {
    const aTime = Date.parse(a.acquiredAt);
    const bTime = Date.parse(b.acquiredAt);
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    if (a.id === b.id) {
      return 0;
    }
    return a.id < b.id ? -1 : 1;
  });

export type ConnectionStatus =
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting';

interface SessionUser {
  id: string;
  username: string;
  roles: string[];
}

interface SessionRoom {
  id: string;
  name: string;
}

const isSessionUser = (value: unknown): value is SessionUser => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionUser & { roles: unknown }>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.username === 'string' &&
    Array.isArray(candidate.roles) &&
    candidate.roles.every((role) => typeof role === 'string')
  );
};

const isSessionRoom = (value: unknown): value is SessionRoom => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SessionRoom>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.name === 'string'
  );
};

export interface RealtimeConnectionState extends InternalConnectionState {
  sendMove: (x: number, y: number) => boolean;
  sendChat: (body: string) => boolean;
  sendPickup: (itemId: string) => boolean;
  clearPickupResult: (itemId?: string) => void;
  updateTypingPreview: (preview: string) => void;
  clearTypingPreview: () => void;
  updateShowSystemMessages: (show: boolean) => void;
  updateAdminAffordances: (updates: Partial<AdminDevAffordanceState>) => Promise<boolean>;
  updateTileLock: (tile: { x: number; y: number }, locked: boolean) => Promise<boolean>;
  updateTileNoPickup: (tile: { x: number; y: number }, noPickup: boolean) => Promise<boolean>;
  requestLatencyTrace: () => Promise<boolean>;
  spawnPlantAtTile: (tile: { x: number; y: number }) => Promise<boolean>;
  fetchOccupantProfile: (occupantId: string) => Promise<ActionResult<OccupantProfileSummary>>;
  initiateTradeWithOccupant: (
    occupantId: string,
  ) => Promise<ActionResult<TradeSessionBootstrap>>;
  muteOccupant: (occupantId: string) => Promise<ActionResult<MuteRecordSummary>>;
  reportOccupant: (
    occupantId: string,
    reason?: string,
  ) => Promise<ActionResult<ReportRecordSummary>>;
}

interface PickupResultState {
  itemId: string;
  status: 'ok' | 'error';
  message: string;
}

interface TypingIndicatorView {
  userId: string;
  preview: string | null;
  expiresAt: number;
}

interface ChatBubbleView {
  userId: string;
  messageId: string;
  body: string;
  expiresAt: number;
}

type TypingIndicatorInternal = { preview: string | null; expiresAt: number };
type ChatBubbleInternal = { body: string; messageId: string; expiresAt: number };

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status: number };

export type OccupantProfileSummary = OccupantProfile;
export type TradeSessionBootstrap = TradeBootstrapResponse;
export type MuteRecordSummary = MuteResponse['mute'];
export type ReportRecordSummary = ReportResponse['report'];

interface InternalConnectionState {
  status: ConnectionStatus;
  lastError: string | null;
  retryInSeconds: number | null;
  heartbeatIntervalMs: number;
  user: SessionUser | null;
  room: SessionRoom | null;
  occupants: RoomOccupant[];
  tileFlags: RoomTileFlag[];
  lastRoomSeq: number | null;
  pendingMoveTarget: { x: number; y: number } | null;
  isMoveInFlight: boolean;
  chatLog: ChatMessageBroadcast[];
  items: RoomItem[];
  inventory: InventoryItem[];
  pendingPickupItemIds: string[];
  lastPickupResult: PickupResultState | null;
  typingIndicators: TypingIndicatorView[];
  chatBubbles: ChatBubbleView[];
  chatPreferences: ChatPreferences | null;
  adminState: AdminState;
}

const cloneOccupant = (occupant: RoomOccupant): RoomOccupant => ({
  ...occupant,
  roles: [...occupant.roles],
  position: { ...occupant.position },
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

const buildEnvelope = (
  seq: number,
  op: string,
  data: Record<string, unknown> = {},
): MessageEnvelope => ({
  op,
  seq,
  ts: Math.floor(Date.now() / 1000),
  data,
});

interface SocketEndpoint {
  origin: string;
  path: string;
}

const normaliseSocketProtocol = (protocol: string): string => {
  switch (protocol) {
    case 'ws:':
      return 'http:';
    case 'wss:':
      return 'https:';
    default:
      return protocol;
  }
};

const resolveSocketEndpoint = (): SocketEndpoint => {
  const raw = import.meta.env.VITE_BITBY_WS_URL;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = new URL(raw);
      const protocol = normaliseSocketProtocol(parsed.protocol);
      const origin = `${protocol}//${parsed.host}`;
      const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/ws';
      return { origin, path };
    } catch {
      // Fall through to default if parsing fails.
    }
  }

  const isSecure = window.location.protocol === 'https:';
  const originProtocol = isSecure ? 'https:' : 'http:';
  const originHost = `${window.location.hostname}:3001`;
  return { origin: `${originProtocol}//${originHost}`, path: '/ws' };
};

const resolveHttpBaseUrl = (): string => {
  if (import.meta.env.VITE_BITBY_HTTP_URL) {
    return import.meta.env.VITE_BITBY_HTTP_URL.replace(/\/$/, '');
  }

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  return `${protocol}://${window.location.hostname}:3001`;
};

const getExplicitToken = (): string | null => {
  const token = import.meta.env.VITE_BITBY_DEV_TOKEN;
  return typeof token === 'string' && token.trim().length > 0 ? token : null;
};

const getDevCredentials = (): { username: string; password: string } => ({
  username: import.meta.env.VITE_BITBY_DEV_USERNAME ?? LOGIN_USERNAME_FALLBACK,
  password: import.meta.env.VITE_BITBY_DEV_PASSWORD ?? LOGIN_PASSWORD_FALLBACK,
});

const getLatestPendingTarget = (
  pendingMoves: Map<number, { to: { x: number; y: number } }>,
): { x: number; y: number } | null => {
  let last: { x: number; y: number } | null = null;
  for (const move of pendingMoves.values()) {
    last = { ...move.to };
  }
  return last;
};

const normaliseTypingPreview = (input: string | null | undefined): string | null => {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, 120);
};

const snapshotTypingIndicators = (
  source: Map<string, TypingIndicatorInternal>,
): TypingIndicatorView[] =>
  Array.from(source.entries()).map(([userId, indicator]) => ({
    userId,
    preview: indicator.preview,
    expiresAt: indicator.expiresAt,
  }));

const snapshotChatBubbles = (
  source: Map<string, ChatBubbleInternal>,
): ChatBubbleView[] =>
  Array.from(source.entries()).map(([userId, bubble]) => ({
    userId,
    messageId: bubble.messageId,
    body: bubble.body,
    expiresAt: bubble.expiresAt,
  }));

export const useRealtimeConnection = (): RealtimeConnectionState => {
  const [state, setState] = useState<InternalConnectionState>({
    status: 'connecting',
    lastError: null,
    retryInSeconds: null,
    heartbeatIntervalMs: DEFAULT_HEARTBEAT_MS,
    user: null,
    room: null,
    occupants: [],
    tileFlags: [],
    lastRoomSeq: null,
    pendingMoveTarget: null,
    isMoveInFlight: false,
    chatLog: [],
    items: [],
    inventory: [],
    pendingPickupItemIds: [],
    lastPickupResult: null,
    typingIndicators: [],
    chatBubbles: [],
    chatPreferences: null,
    adminState: { ...DEFAULT_ADMIN_STATE },
  });

  const socketRef = useRef<Socket | null>(null);
  const seqRef = useRef(1);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const disposedRef = useRef(false);
  const tokenRef = useRef<string | null>(getExplicitToken());
  const loginPromiseRef = useRef<Promise<string> | null>(null);
  const loginAbortRef = useRef<AbortController | null>(null);
  const occupantMapRef = useRef(new Map<string, RoomOccupant>());
  const pendingMovesRef = useRef(
    new Map<number, { from: { x: number; y: number }; to: { x: number; y: number } }>(),
  );
  const sessionUserRef = useRef<SessionUser | null>(null);
  const roomItemsRef = useRef(new Map<string, RoomItem>());
  const inventoryRef = useRef(new Map<string, InventoryItem>());
  const pendingPickupsRef = useRef(new Map<number, RoomItem>());
  const pendingPickupItemIdRef = useRef(new Map<string, number>());
  const typingIndicatorsRef = useRef(new Map<string, TypingIndicatorInternal>());
  const chatBubblesRef = useRef(new Map<string, ChatBubbleInternal>());
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingCleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bubbleCleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingPreviewRef = useRef('');

  useEffect(() => {
    disposedRef.current = false;

    const endpoint = resolveSocketEndpoint();

    const clearPingTimer = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const clearCountdownTimer = () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };

    const clearTypingCleanupTimer = () => {
      if (typingCleanupIntervalRef.current) {
        clearInterval(typingCleanupIntervalRef.current);
        typingCleanupIntervalRef.current = null;
      }
    };

    const clearBubbleCleanupTimer = () => {
      if (bubbleCleanupIntervalRef.current) {
        clearInterval(bubbleCleanupIntervalRef.current);
        bubbleCleanupIntervalRef.current = null;
      }
    };

    const abortLogin = () => {
      if (loginAbortRef.current) {
        loginAbortRef.current.abort();
        loginAbortRef.current = null;
      }
      loginPromiseRef.current = null;
    };

    const clearActiveSocket = () => {
      const active = socketRef.current;
      if (!active) {
        return;
      }

      active.removeAllListeners();
      if (active.connected) {
        active.disconnect();
      }
      socketRef.current = null;
      typingIndicatorsRef.current.clear();
      chatBubblesRef.current.clear();
      clearTypingCleanupTimer();
      clearBubbleCleanupTimer();
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      lastTypingPreviewRef.current = '';
      updateState({ typingIndicators: [], chatBubbles: [] });
    };

    const startPingTimer = (intervalMs: number) => {
      clearPingTimer();
      pingTimerRef.current = setInterval(() => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          return;
        }

        const envelope = buildEnvelope(seqRef.current, 'ping', {
          clientTs: Date.now(),
        });
        seqRef.current += 1;
        socket.emit('message', envelope);
      }, intervalMs);
    };

    const updateState = (partial: Partial<InternalConnectionState>) => {
      setState((previous) => {
        const next = {
          ...previous,
          ...partial,
        };

        if (import.meta.env.DEV && previous.status !== next.status) {
          console.debug('[realtime] status', previous.status, '→', next.status);
        }

        if (
          import.meta.env.DEV &&
          next.lastError &&
          next.lastError !== previous.lastError
        ) {
          console.debug('[realtime] lastError', next.lastError);
        }

        return next;
      });
    };

    const requestAuthToken = async (): Promise<string> => {
      if (disposedRef.current) {
        throw new Error('Realtime connection disposed');
      }

      const explicit = getExplicitToken();
      if (explicit) {
        tokenRef.current = explicit;
        return explicit;
      }

      if (tokenRef.current) {
        return tokenRef.current;
      }

      if (loginPromiseRef.current) {
        return loginPromiseRef.current;
      }

      const { username, password } = getDevCredentials();
      const baseUrl = resolveHttpBaseUrl();

      if (loginAbortRef.current) {
        loginAbortRef.current.abort();
      }

      const controller = new AbortController();
      loginAbortRef.current = controller;

      const promise = fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const clone = response.clone();
            let message = `Login failed (${response.status})`;
            try {
              const errorJson = await clone.json();
              if (errorJson && typeof errorJson.message === 'string') {
                message = `${message}: ${errorJson.message}`;
              }
            } catch {
              const errorText = await clone.text().catch(() => '');
              if (errorText) {
                message = `${message}: ${errorText}`;
              }
            }
            throw new Error(message);
          }

          let payload: unknown;
          try {
            payload = await response.json();
          } catch (error) {
            throw new Error('Unable to parse login response');
          }

          if (!payload || typeof payload !== 'object') {
            throw new Error('Login response missing token');
          }

          const tokenValue = (payload as { token?: unknown }).token;
          if (typeof tokenValue !== 'string' || tokenValue.length === 0) {
            throw new Error('Login response missing token');
          }

          tokenRef.current = tokenValue;
          return tokenValue;
        });

      loginPromiseRef.current = promise
        .catch((error) => {
          tokenRef.current = null;
          throw error;
        })
        .finally(() => {
          if (loginPromiseRef.current === promise) {
            loginPromiseRef.current = null;
          }
          if (loginAbortRef.current === controller) {
            loginAbortRef.current = null;
          }
        });

      if (!loginPromiseRef.current) {
        throw new Error('Failed to initialise login flow');
      }

      return loginPromiseRef.current;
    };

    const scheduleReconnect = () => {
      clearPingTimer();
      clearCountdownTimer();
      abortLogin();
      clearActiveSocket();
      pendingMovesRef.current.clear();
      occupantMapRef.current.clear();
      sessionUserRef.current = null;
      typingIndicatorsRef.current.clear();
      chatBubblesRef.current.clear();
      clearTypingCleanupTimer();
      clearBubbleCleanupTimer();
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      lastTypingPreviewRef.current = '';

      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);
      const retrySeconds = Math.max(1, Math.ceil(delay / 1000));

      updateState({
        status: 'reconnecting',
        retryInSeconds: retrySeconds,
        occupants: [],
        tileFlags: [],
        pendingMoveTarget: null,
        isMoveInFlight: false,
        chatLog: [],
        typingIndicators: [],
        chatBubbles: [],
      });

      countdownTimerRef.current = setInterval(() => {
        setState((previous) => {
          if (previous.retryInSeconds === null || previous.retryInSeconds <= 0) {
            return previous;
          }

          return {
            ...previous,
            retryInSeconds: previous.retryInSeconds - 1,
          };
        });
      }, 1000);

      reconnectTimerRef.current = setTimeout(() => {
        clearCountdownTimer();
        updateState({ retryInSeconds: null });
        void connect();
      }, delay);
    };

    const appendChatMessage = (message: ChatMessageBroadcast) => {
      setState((previous) => {
        const nextSeq = message.roomSeq ?? previous.lastRoomSeq ?? null;
        const nextLog = [...previous.chatLog, message].slice(-200);
        return {
          ...previous,
          chatLog: nextLog,
          lastRoomSeq:
            nextSeq === null
              ? previous.lastRoomSeq
              : Math.max(previous.lastRoomSeq ?? 0, nextSeq),
        };
      });
    };

    const publishTypingIndicators = () => {
      updateState({ typingIndicators: snapshotTypingIndicators(typingIndicatorsRef.current) });
    };

    const pruneTypingIndicators = (now: number = Date.now()): void => {
      let changed = false;
      for (const [userId, indicator] of typingIndicatorsRef.current.entries()) {
        if (indicator.expiresAt <= now) {
          typingIndicatorsRef.current.delete(userId);
          changed = true;
        }
      }
      if (changed) {
        publishTypingIndicators();
      }
    };

    const scheduleTypingCleanup = () => {
      if (!typingCleanupIntervalRef.current) {
        typingCleanupIntervalRef.current = setInterval(() => {
          pruneTypingIndicators();
          if (typingIndicatorsRef.current.size === 0) {
            clearTypingCleanupTimer();
          }
        }, 1000);
      }
    };

    const upsertTypingIndicator = (
      userId: string,
      preview: string | null,
      expiresAt?: number,
    ): void => {
      const expiry =
        typeof expiresAt === 'number' && Number.isFinite(expiresAt)
          ? expiresAt
          : Date.now() + TYPING_TTL_MS;
      typingIndicatorsRef.current.set(userId, {
        preview: normaliseTypingPreview(preview),
        expiresAt: expiry,
      });
      publishTypingIndicators();
      scheduleTypingCleanup();
    };

    const removeTypingIndicator = (userId: string): void => {
      if (typingIndicatorsRef.current.delete(userId)) {
        publishTypingIndicators();
        if (typingIndicatorsRef.current.size === 0) {
          clearTypingCleanupTimer();
        }
      }
    };

    const publishChatBubbles = () => {
      updateState({ chatBubbles: snapshotChatBubbles(chatBubblesRef.current) });
    };

    const pruneChatBubbles = (now: number = Date.now()): void => {
      let changed = false;
      for (const [userId, bubble] of chatBubblesRef.current.entries()) {
        if (bubble.expiresAt <= now) {
          chatBubblesRef.current.delete(userId);
          changed = true;
        }
      }
      if (changed) {
        publishChatBubbles();
      }
    };

    const scheduleBubbleCleanup = () => {
      if (!bubbleCleanupIntervalRef.current) {
        bubbleCleanupIntervalRef.current = setInterval(() => {
          pruneChatBubbles();
          if (chatBubblesRef.current.size === 0) {
            clearBubbleCleanupTimer();
          }
        }, 1000);
      }
    };

    const upsertChatBubble = (userId: string, messageId: string, body: string): void => {
      chatBubblesRef.current.set(userId, {
        messageId,
        body,
        expiresAt: Date.now() + CHAT_BUBBLE_TTL_MS,
      });
      publishChatBubbles();
      scheduleBubbleCleanup();
    };

    const removeChatBubble = (userId: string): void => {
      if (chatBubblesRef.current.delete(userId)) {
        publishChatBubbles();
        if (chatBubblesRef.current.size === 0) {
          clearBubbleCleanupTimer();
        }
      }
    };

    const handleEnvelope = (envelope: MessageEnvelope) => {
      switch (envelope.op) {
        case 'auth:ok': {
          const payload = (envelope.data ?? {}) as Record<string, unknown>;
          const userCandidate = payload.user;
          const roomCandidate = payload.room;
          const snapshotResult = roomSnapshotSchema.safeParse(payload.roomSnapshot);
          const chatHistoryRaw = Array.isArray(payload.chatHistory)
            ? payload.chatHistory
            : [];
          const chatHistory: ChatMessageBroadcast[] = [];
          for (const entry of chatHistoryRaw) {
            const parsedEntry = chatMessageBroadcastSchema.safeParse(entry);
            if (parsedEntry.success) {
              chatHistory.push(parsedEntry.data);
            }
          }
          const inventoryRaw = Array.isArray(payload.inventory) ? payload.inventory : [];
          const inventoryItems: InventoryItem[] = [];
          for (const entry of inventoryRaw) {
            const parsedInventory = inventoryItemSchema.safeParse(entry);
            if (parsedInventory.success) {
              inventoryItems.push(parsedInventory.data);
            }
          }
          const intervalFromServer =
            typeof envelope.data?.heartbeatIntervalMs === 'number'
              ? envelope.data.heartbeatIntervalMs
              : DEFAULT_HEARTBEAT_MS;

          if (!isSessionUser(userCandidate) || !isSessionRoom(roomCandidate)) {
            updateState({
              lastError: 'Server handshake payload missing user or room',
            });
            return;
          }

          if (!snapshotResult.success) {
            updateState({ lastError: 'Server snapshot payload was invalid' });
            return;
          }

          const normalizedUser: SessionUser = {
            id: userCandidate.id,
            username: userCandidate.username,
            roles: [...userCandidate.roles],
          };
          const normalizedRoom: SessionRoom = {
            id: roomCandidate.id,
            name: roomCandidate.name,
          };

          sessionUserRef.current = normalizedUser;

          occupantMapRef.current = new Map(
            snapshotResult.data.occupants.map((occupant: RoomOccupant) => [
              occupant.id,
              cloneOccupant(occupant),
            ]),
          );
          pendingMovesRef.current.clear();
          roomItemsRef.current = new Map(
            snapshotResult.data.items.map((item: RoomItem) => [item.id, { ...item }]),
          );
          inventoryRef.current = new Map(
            inventoryItems.map((item) => [item.id, { ...item }]),
          );
          pendingPickupsRef.current.clear();
          pendingPickupItemIdRef.current.clear();
          typingIndicatorsRef.current.clear();
          chatBubblesRef.current.clear();
          clearTypingCleanupTimer();
          clearBubbleCleanupTimer();
          if (typingStopTimerRef.current) {
            clearTimeout(typingStopTimerRef.current);
            typingStopTimerRef.current = null;
          }
          lastTypingPreviewRef.current = '';

          const typingIndicatorsList: TypingIndicatorView[] = [];
          const typingRaw = Array.isArray(payload.typingIndicators)
            ? payload.typingIndicators
            : [];
          for (const entry of typingRaw) {
            const parsedTyping = chatTypingBroadcastSchema.safeParse(entry);
            if (!parsedTyping.success || !parsedTyping.data.isTyping) {
              continue;
            }
            const expiryMs =
              typeof parsedTyping.data.expiresAt === 'string'
                ? Date.parse(parsedTyping.data.expiresAt)
                : Date.now() + TYPING_TTL_MS;
            const expiresAt = Number.isFinite(expiryMs)
              ? expiryMs
              : Date.now() + TYPING_TTL_MS;
            const preview = normaliseTypingPreview(parsedTyping.data.preview ?? null);
            typingIndicatorsRef.current.set(parsedTyping.data.userId, {
              preview,
              expiresAt,
            });
            typingIndicatorsList.push({
              userId: parsedTyping.data.userId,
              preview,
              expiresAt,
            });
          }
          if (typingIndicatorsRef.current.size > 0) {
            scheduleTypingCleanup();
          }

          const preferencesResult = chatPreferencesSchema.safeParse(
            payload.chatPreferences,
          );
          const chatPreferences: ChatPreferences = preferencesResult.success
            ? preferencesResult.data
            : { showSystemMessages: true };

          const maxSeqCandidates: number[] = [snapshotResult.data.roomSeq];
          for (const entry of chatHistory) {
            if (typeof entry.roomSeq === 'number') {
              maxSeqCandidates.push(entry.roomSeq);
            }
          }
          const maxSeq = Math.max(...maxSeqCandidates);

          setState((previous) => ({
            ...previous,
            status: 'connected',
            lastError: null,
            retryInSeconds: null,
            heartbeatIntervalMs: intervalFromServer,
            user: normalizedUser,
            room: normalizedRoom,
            occupants: sortOccupants(occupantMapRef.current),
            tileFlags: snapshotResult.data.tiles.map((tile: RoomTileFlag) => ({ ...tile })),
            lastRoomSeq: maxSeq,
            pendingMoveTarget: null,
            isMoveInFlight: false,
            chatLog: chatHistory,
            items: sortRoomItems(roomItemsRef.current.values()),
            inventory: sortInventoryItems(inventoryRef.current.values()),
            pendingPickupItemIds: [],
            lastPickupResult: null,
            typingIndicators: typingIndicatorsList,
            chatBubbles: [],
            chatPreferences,
            adminState: snapshotResult.data.adminState,
          }));

          startPingTimer(intervalFromServer);
          return;
        }
        case 'move:ok': {
          const result = moveOkDataSchema.safeParse(envelope.data);
          if (!result.success) {
            updateState({ lastError: 'Received malformed move:ok payload' });
            return;
          }

          const user = sessionUserRef.current;
          if (user) {
            const occupant = occupantMapRef.current.get(user.id);
            if (occupant) {
              const updated: RoomOccupant = {
                ...occupant,
                position: { x: result.data.x, y: result.data.y },
              };
              occupantMapRef.current.set(updated.id, updated);
            }
          }

          pendingMovesRef.current.delete(envelope.seq);

          setState((previous) => ({
            ...previous,
            occupants: sortOccupants(occupantMapRef.current),
            lastRoomSeq: result.data.roomSeq,
            pendingMoveTarget: getLatestPendingTarget(pendingMovesRef.current),
            isMoveInFlight: pendingMovesRef.current.size > 0,
          }));

          return;
        }
        case 'move:err': {
          const result = moveErrorDataSchema.safeParse(envelope.data);
          if (!result.success) {
            updateState({ lastError: 'Received malformed move:err payload' });
            return;
          }

          const user = sessionUserRef.current;
          if (user) {
            const occupant = occupantMapRef.current.get(user.id);
            if (occupant) {
              const updated: RoomOccupant = {
                ...occupant,
                position: {
                  x: result.data.current.x,
                  y: result.data.current.y,
                },
              };
              occupantMapRef.current.set(updated.id, updated);
            }
          }

          pendingMovesRef.current.delete(envelope.seq);

          setState((previous) => ({
            ...previous,
            occupants: sortOccupants(occupantMapRef.current),
            lastRoomSeq: result.data.roomSeq,
            pendingMoveTarget: getLatestPendingTarget(pendingMovesRef.current),
            isMoveInFlight: pendingMovesRef.current.size > 0,
          }));

          return;
        }
        case 'room:occupant_moved': {
          const result = roomOccupantMovedDataSchema.safeParse(envelope.data);
          if (!result.success) {
            updateState({ lastError: 'Received malformed occupant update' });
            return;
          }

          const occupant = cloneOccupant(result.data.occupant);
          occupantMapRef.current.set(occupant.id, occupant);

          if (sessionUserRef.current && occupant.id === sessionUserRef.current.id) {
            for (const [seq, pending] of pendingMovesRef.current.entries()) {
              if (
                pending.to.x === occupant.position.x &&
                pending.to.y === occupant.position.y
              ) {
                pendingMovesRef.current.delete(seq);
              }
            }
          }

          setState((previous) => ({
            ...previous,
            occupants: sortOccupants(occupantMapRef.current),
            lastRoomSeq: result.data.roomSeq,
            pendingMoveTarget: sessionUserRef.current && occupant.id === sessionUserRef.current.id
              ? getLatestPendingTarget(pendingMovesRef.current)
              : previous.pendingMoveTarget,
            isMoveInFlight: pendingMovesRef.current.size > 0,
          }));

          return;
        }
        case 'room:occupant_left': {
          const result = roomOccupantLeftDataSchema.safeParse(envelope.data);
          if (!result.success) {
            updateState({ lastError: 'Received malformed occupant departure' });
            return;
          }

          occupantMapRef.current.delete(result.data.occupantId);
          removeTypingIndicator(result.data.occupantId);
          removeChatBubble(result.data.occupantId);

          setState((previous) => ({
            ...previous,
            occupants: sortOccupants(occupantMapRef.current),
            lastRoomSeq: result.data.roomSeq,
            pendingMoveTarget: previous.pendingMoveTarget,
            isMoveInFlight: pendingMovesRef.current.size > 0,
          }));

          return;
        }
        case 'chat:new': {
          const parsed = chatMessageBroadcastSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed chat:new payload' });
            return;
          }

          removeTypingIndicator(parsed.data.userId);
          const isSystemMessage = parsed.data.roles.some(
            (role: string) => role.toLowerCase() === 'system',
          );
          if (!isSystemMessage) {
            upsertChatBubble(parsed.data.userId, parsed.data.id, parsed.data.body);
          }
          appendChatMessage(parsed.data);
          return;
        }
        case 'chat:typing': {
          const parsed = chatTypingBroadcastSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed chat:typing payload' });
            return;
          }

          if (parsed.data.isTyping) {
            const expiryMs =
              typeof parsed.data.expiresAt === 'string'
                ? Date.parse(parsed.data.expiresAt)
                : Date.now() + TYPING_TTL_MS;
            const expiresAt = Number.isFinite(expiryMs)
              ? expiryMs
              : Date.now() + TYPING_TTL_MS;
            upsertTypingIndicator(parsed.data.userId, parsed.data.preview ?? null, expiresAt);
          } else {
            removeTypingIndicator(parsed.data.userId);
          }
          return;
        }
        case 'chat:ok': {
          return;
        }
        case 'chat:typing:ok': {
          return;
        }
        case 'chat:typing:err': {
          updateState({ lastError: 'Typing update rejected by server' });
          return;
        }
        case 'chat:preferences:ok': {
          const parsed = chatPreferencesSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed chat preferences payload' });
            return;
          }

          setState((previous) => ({
            ...previous,
            chatPreferences: parsed.data,
          }));
          return;
        }
        case 'chat:preferences:err': {
          const message =
            typeof envelope.data?.message === 'string'
              ? envelope.data.message
              : 'Failed to update chat preferences';
          updateState({ lastError: message });
          return;
        }
        case 'item:pickup:ok': {
          const parsed = itemPickupOkDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed item:pickup:ok payload' });
            return;
          }

          const seq = envelope.seq;
          pendingPickupsRef.current.delete(seq);
          pendingPickupItemIdRef.current.delete(parsed.data.itemId);
          roomItemsRef.current.delete(parsed.data.itemId);

          const inventoryItem = { ...parsed.data.inventoryItem };
          inventoryRef.current.set(inventoryItem.id, inventoryItem);

          setState((previous) => ({
            ...previous,
            items: sortRoomItems(roomItemsRef.current.values()),
            inventory: sortInventoryItems(inventoryRef.current.values()),
            pendingPickupItemIds: previous.pendingPickupItemIds.filter(
              (id) => id !== parsed.data.itemId,
            ),
            lastPickupResult: {
              itemId: parsed.data.itemId,
              status: 'ok',
              message: 'Lagt i rygsæk',
            },
            lastRoomSeq: parsed.data.roomSeq,
          }));

          return;
        }
        case 'item:pickup:err': {
          const parsed = itemPickupErrorDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed item:pickup:err payload' });
            return;
          }

          const seq = envelope.seq;
          const pendingItem = pendingPickupsRef.current.get(seq) ?? null;
          pendingPickupsRef.current.delete(seq);
          pendingPickupItemIdRef.current.delete(parsed.data.itemId);

          if (
            pendingItem &&
            parsed.data.code !== 'not_found' &&
            parsed.data.code !== 'already_picked_up'
          ) {
            roomItemsRef.current.set(pendingItem.id, { ...pendingItem });
          }

          setState((previous) => ({
            ...previous,
            items: sortRoomItems(roomItemsRef.current.values()),
            pendingPickupItemIds: previous.pendingPickupItemIds.filter(
              (id) => id !== parsed.data.itemId,
            ),
            lastPickupResult: {
              itemId: parsed.data.itemId,
              status: 'error',
              message: parsed.data.message,
            },
            lastRoomSeq: parsed.data.roomSeq,
          }));

          return;
        }
        case 'room:item_added': {
          const parsed = roomItemAddedDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed room:item_added payload' });
            return;
          }

          roomItemsRef.current.set(parsed.data.item.id, { ...parsed.data.item });

          setState((previous) => ({
            ...previous,
            items: sortRoomItems(roomItemsRef.current.values()),
            lastRoomSeq: parsed.data.roomSeq,
          }));

          return;
        }
        case 'room:item_removed': {
          const parsed = roomItemRemovedDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed room:item_removed payload' });
            return;
          }

          const pendingSeq = pendingPickupItemIdRef.current.get(parsed.data.itemId);
          if (typeof pendingSeq === 'number') {
            pendingPickupItemIdRef.current.delete(parsed.data.itemId);
            pendingPickupsRef.current.delete(pendingSeq);
          }

          roomItemsRef.current.delete(parsed.data.itemId);

          setState((previous) => ({
            ...previous,
            items: sortRoomItems(roomItemsRef.current.values()),
            pendingPickupItemIds: previous.pendingPickupItemIds.filter(
              (id) => id !== parsed.data.itemId,
            ),
            lastRoomSeq: parsed.data.roomSeq,
          }));

          return;
        }
        case 'admin:tile_flag:update': {
          const parsed = adminTileFlagUpdateDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed admin tile flag update' });
            return;
          }

          const { tile, roomSeq } = parsed.data;
          setState((previous) => {
            const nextFlags = [...previous.tileFlags];
            const index = nextFlags.findIndex(
              (flag) => flag.x === tile.x && flag.y === tile.y,
            );
            if (index >= 0) {
              nextFlags[index] = { ...tile };
            } else {
              nextFlags.push({ ...tile });
            }
            const nextSeq = previous.lastRoomSeq
              ? Math.max(previous.lastRoomSeq, roomSeq)
              : roomSeq;
            return { ...previous, tileFlags: nextFlags, lastRoomSeq: nextSeq };
          });

          return;
        }
        case 'admin:affordance:update': {
          const parsed = adminAffordanceUpdateDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed admin affordance payload' });
            return;
          }

          setState((previous) => ({
            ...previous,
            adminState: {
              ...previous.adminState,
              affordances: { ...parsed.data.state },
            },
          }));

          return;
        }
        case 'admin:latency:trace': {
          const parsed = adminLatencyTraceEventDataSchema.safeParse(envelope.data);
          if (!parsed.success) {
            updateState({ lastError: 'Received malformed latency trace payload' });
            return;
          }

          setState((previous) => ({
            ...previous,
            adminState: {
              ...previous.adminState,
              lastLatencyTrace: parsed.data.trace,
            },
          }));

          return;
        }
        case 'error:chat_payload': {
          const message =
            typeof (envelope.data as { message?: unknown })?.message === 'string'
              ? (envelope.data as { message: string }).message
              : 'Chat payload rejected';
          updateState({ lastError: message });
          return;
        }
        case 'pong': {
          return;
        }
        case 'system:hello':
        case 'system:room_snapshot': {
          return;
        }
        default: {
          if (envelope.op.startsWith('error:')) {
            const message =
              typeof envelope.data?.message === 'string'
                ? envelope.data.message
                : 'Realtime error received';
            if (
              envelope.op === 'error:auth_invalid' ||
              envelope.op === 'error:not_authenticated'
            ) {
              tokenRef.current = null;
            }
            updateState({ lastError: message });
          }
        }
      }
    };

    const connect = async () => {
      if (disposedRef.current) {
        return;
      }

      clearPingTimer();
      clearCountdownTimer();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      updateState({
        status: 'connecting',
        pendingMoveTarget: null,
        isMoveInFlight: false,
      });

      if (import.meta.env.DEV) {
        console.debug('[realtime] requesting auth token from server');
      }

      let token: string;
      try {
        token = await requestAuthToken();
      } catch (error) {
        if (disposedRef.current) {
          return;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          if (import.meta.env.DEV) {
            console.debug('[realtime] login request aborted');
          }
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Failed to fetch auth token';
        updateState({ lastError: message });
        scheduleReconnect();
        return;
      }

      if (disposedRef.current) {
        return;
      }

      const socket = io(endpoint.origin, {
        path: endpoint.path,
        transports: ['websocket'],
        autoConnect: false,
        reconnection: false,
      });

      socketRef.current = socket;

      const detachListeners = () => {
        socket.off('connect');
        socket.off('message');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('error');
      };

      socket.on('connect', () => {
        if (disposedRef.current) {
          detachListeners();
          socket.disconnect();
          return;
        }

        reconnectAttemptsRef.current = 0;
        updateState({ status: 'authenticating', lastError: null, retryInSeconds: null });

        if (import.meta.env.DEV) {
          console.debug('[realtime] socket.io connected, sending auth envelope');
        }

        const authEnvelope = buildEnvelope(seqRef.current, 'auth', { token });
        seqRef.current += 1;
        socket.emit('message', authEnvelope);
      });

      socket.on('message', (payload: unknown) => {
        if (disposedRef.current) {
          return;
        }

        let candidate: unknown = payload;
        if (typeof payload === 'string') {
          try {
            candidate = JSON.parse(payload);
          } catch (error) {
            updateState({ lastError: 'Received malformed JSON from server' });
            return;
          }
        }

        const result = messageEnvelopeSchema.safeParse(candidate);
        if (!result.success) {
          updateState({ lastError: 'Server envelope validation failed' });
          return;
        }

        handleEnvelope(result.data);
      });

      socket.on('disconnect', (reason: Socket.DisconnectReason) => {
        detachListeners();
        if (disposedRef.current) {
          return;
        }

        const message = reason ? `Connection closed (${reason})` : 'Connection closed';
        updateState({ lastError: message });
        socketRef.current = null;
        scheduleReconnect();
      });

      socket.on('connect_error', (error: Error) => {
        detachListeners();
        if (disposedRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Connection failed';
        updateState({ lastError: message });
        socketRef.current = null;
        scheduleReconnect();
      });

      socket.on('error', () => {
        if (disposedRef.current) {
          return;
        }

        updateState({ lastError: 'WebSocket transport error' });
      });

      socket.connect();
    };

    void connect();

    return () => {
      disposedRef.current = true;
      clearPingTimer();
      clearCountdownTimer();
      abortLogin();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      clearActiveSocket();
    };
  }, []);

  const sendMove = useCallback(
    (x: number, y: number): boolean => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return false;
      }

      if (state.status !== 'connected') {
        return false;
      }

      const validation = moveRequestDataSchema.safeParse({ x, y });
      if (!validation.success) {
        return false;
      }

      const user = sessionUserRef.current;
      if (!user) {
        return false;
      }

      const occupant = occupantMapRef.current.get(user.id);
      if (!occupant) {
        return false;
      }

      const seq = seqRef.current;
      seqRef.current += 1;

      pendingMovesRef.current.set(seq, {
        from: { ...occupant.position },
        to: { ...validation.data },
      });

      const optimistic: RoomOccupant = {
        ...occupant,
        position: { ...validation.data },
      };
      occupantMapRef.current.set(optimistic.id, optimistic);

      setState((previous) => ({
        ...previous,
        occupants: sortOccupants(occupantMapRef.current),
        pendingMoveTarget: getLatestPendingTarget(pendingMovesRef.current),
        isMoveInFlight: true,
      }));

      const envelope = buildEnvelope(seq, 'move', validation.data);
      socket.emit('message', envelope);
      return true;
    },
    [state.status],
  );

  const clearTypingPreview = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }

    const userId = sessionUserRef.current?.id ?? null;
    if (userId && typingIndicatorsRef.current.delete(userId)) {
      setState((previous) => ({
        ...previous,
        typingIndicators: snapshotTypingIndicators(typingIndicatorsRef.current),
      }));
    }

    if (typingIndicatorsRef.current.size === 0 && typingCleanupIntervalRef.current) {
      clearInterval(typingCleanupIntervalRef.current);
      typingCleanupIntervalRef.current = null;
    }

    const shouldSend = state.status === 'connected' && lastTypingPreviewRef.current !== '';
    lastTypingPreviewRef.current = '';

    const socket = socketRef.current;
    if (!shouldSend || !socket || !socket.connected) {
      return;
    }

    const payloadResult = chatTypingUpdateDataSchema.safeParse({ isTyping: false });
    if (!payloadResult.success) {
      return;
    }

    const seq = seqRef.current;
    seqRef.current += 1;
    socket.emit('message', buildEnvelope(seq, 'chat:typing', payloadResult.data));
  }, [state.status]);

  const updateTypingPreview = useCallback(
    (preview: string) => {
      const normalized = normaliseTypingPreview(preview);
      if (normalized === null) {
        clearTypingPreview();
        return;
      }

      const userId = sessionUserRef.current?.id ?? null;
      if (userId) {
        typingIndicatorsRef.current.set(userId, {
          preview: normalized,
          expiresAt: Date.now() + TYPING_TTL_MS,
        });
        setState((previous) => ({
          ...previous,
          typingIndicators: snapshotTypingIndicators(typingIndicatorsRef.current),
        }));
      }

      if (!typingCleanupIntervalRef.current) {
        typingCleanupIntervalRef.current = setInterval(() => {
          const now = Date.now();
          let changed = false;
          for (const [id, indicator] of typingIndicatorsRef.current.entries()) {
            if (indicator.expiresAt <= now) {
              typingIndicatorsRef.current.delete(id);
              changed = true;
            }
          }
          if (changed) {
            setState((previous) => ({
              ...previous,
              typingIndicators: snapshotTypingIndicators(typingIndicatorsRef.current),
            }));
          }
          if (typingIndicatorsRef.current.size === 0 && typingCleanupIntervalRef.current) {
            clearInterval(typingCleanupIntervalRef.current);
            typingCleanupIntervalRef.current = null;
          }
        }, 1000);
      }

      const socket = socketRef.current;
      if (state.status !== 'connected' || !socket || !socket.connected) {
        lastTypingPreviewRef.current = normalized;
        if (typingStopTimerRef.current) {
          clearTimeout(typingStopTimerRef.current);
        }
        typingStopTimerRef.current = setTimeout(() => {
          clearTypingPreview();
        }, 4000);
        return;
      }

      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
      }

      if (normalized === lastTypingPreviewRef.current) {
        typingStopTimerRef.current = setTimeout(() => {
          clearTypingPreview();
        }, 4000);
        return;
      }

      const payloadResult = chatTypingUpdateDataSchema.safeParse({
        preview: normalized,
        isTyping: true,
      });
      if (!payloadResult.success) {
        if (import.meta.env.DEV) {
          console.warn('[chat] Ignoring invalid typing payload', payloadResult.error);
        }
        return;
      }

      const seq = seqRef.current;
      seqRef.current += 1;
      socket.emit('message', buildEnvelope(seq, 'chat:typing', payloadResult.data));
      lastTypingPreviewRef.current = normalized;
      typingStopTimerRef.current = setTimeout(() => {
        clearTypingPreview();
      }, 4000);
    },
    [clearTypingPreview, state.status],
  );

  const sendChat = useCallback(
    (body: string): boolean => {
      if (state.status !== 'connected') {
        return false;
      }

      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return false;
      }

      const trimmed = body.trim();
      if (trimmed.length === 0) {
        return false;
      }

      const seq = seqRef.current;
      seqRef.current += 1;
      const envelope = buildEnvelope(seq, 'chat:send', { body: trimmed });
      socket.emit('message', envelope);
      clearTypingPreview();
      return true;
    },
    [clearTypingPreview, state.status],
  );

  const sendPickup = useCallback(
    (itemId: string): boolean => {
      if (state.status !== 'connected') {
        return false;
      }

      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return false;
      }

      if (pendingPickupItemIdRef.current.has(itemId)) {
        return false;
      }

      const validation = itemPickupRequestDataSchema.safeParse({ itemId });
      if (!validation.success) {
        if (import.meta.env.DEV) {
          console.warn('[items] Ignoring invalid item pickup payload', validation.error);
        }
        return false;
      }

      const item = roomItemsRef.current.get(itemId);
      if (!item) {
        return false;
      }

      const seq = seqRef.current;
      seqRef.current += 1;

      pendingPickupsRef.current.set(seq, { ...item });
      pendingPickupItemIdRef.current.set(itemId, seq);
      roomItemsRef.current.delete(itemId);

      setState((previous) => ({
        ...previous,
        items: sortRoomItems(roomItemsRef.current.values()),
        pendingPickupItemIds: [...previous.pendingPickupItemIds, itemId],
        lastPickupResult:
          previous.lastPickupResult && previous.lastPickupResult.itemId === itemId
            ? null
            : previous.lastPickupResult,
      }));

      const envelope = buildEnvelope(seq, 'item:pickup', validation.data);
      socket.emit('message', envelope);
      return true;
    },
    [state.status],
  );

  const clearPickupResult = useCallback((itemId?: string) => {
    setState((previous) => {
      if (!previous.lastPickupResult) {
        return previous;
      }

      if (itemId && previous.lastPickupResult.itemId !== itemId) {
        return previous;
      }

      return { ...previous, lastPickupResult: null };
    });
  }, []);

  const updateShowSystemMessages = useCallback(
    (show: boolean) => {
      setState((previous) => ({
        ...previous,
        chatPreferences: {
          ...(previous.chatPreferences ?? { showSystemMessages: true }),
          showSystemMessages: show,
        },
      }));

      if (state.status !== 'connected') {
        return;
      }

      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        return;
      }

      const payloadResult = chatPreferenceUpdateDataSchema.safeParse({
        showSystemMessages: show,
      });
      if (!payloadResult.success) {
        if (import.meta.env.DEV) {
          console.warn('[chat] Invalid preference payload', payloadResult.error);
        }
        return;
      }

      const seq = seqRef.current;
      seqRef.current += 1;
      socket.emit('message', buildEnvelope(seq, 'chat:preferences:update', payloadResult.data));
    },
    [state.status],
  );

  const sendAdminPost = useCallback(
    async (path: string, body: Record<string, unknown>): Promise<boolean> => {
      if (state.status !== 'connected') {
        return false;
      }

      const baseUrl = resolveHttpBaseUrl();
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          if (import.meta.env.DEV) {
            console.warn('[admin] Request failed', path, response.status);
          }
          return false;
        }

        return true;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[admin] Request error', path, error);
        }
        return false;
      }
    },
    [state.status],
  );

  const sendAuthorizedRequest = useCallback(
    async <T>(
      path: string,
      options: RequestInit,
      parse: (payload: unknown) => T,
    ): Promise<ActionResult<T>> => {
      const token = tokenRef.current;
      if (!token) {
        return { ok: false, message: 'Authentication required', status: 401 };
      }

      const baseUrl = resolveHttpBaseUrl();
      const headers = new Headers(options.headers ?? {});
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      headers.set('Authorization', `Bearer ${token}`);

      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers,
          credentials: 'include',
        });

        if (!response.ok) {
          let message = `Request failed (${response.status})`;
          try {
            const errorJson = await response.json();
            if (errorJson && typeof errorJson.message === 'string') {
              message = errorJson.message;
            }
          } catch {
            // Ignore JSON parse errors and fall back to the default message.
          }
          return { ok: false, message, status: response.status };
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          return { ok: false, message: 'Malformed response payload', status: response.status };
        }

        try {
          const data = parse(payload);
          return { ok: true, data };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unable to parse response payload';
          return { ok: false, message, status: response.status };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to reach the server';
        return { ok: false, message, status: 0 };
      }
    },
    [],
  );

  const updateAdminAffordances = useCallback(
    async (updates: Partial<AdminDevAffordanceState>): Promise<boolean> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return false;
      }

      const payload = {
        ...state.adminState.affordances,
        ...updates,
        updatedBy: state.user?.id ?? 'admin',
      } satisfies Record<string, unknown>;
      return sendAdminPost(`/admin/rooms/${roomId}/dev-affordances`, payload);
    },
    [sendAdminPost, state.adminState.affordances, state.room?.id, state.user?.id],
  );

  const updateTileLock = useCallback(
    async (tile: { x: number; y: number }, locked: boolean): Promise<boolean> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return false;
      }

      return sendAdminPost(`/admin/rooms/${roomId}/tiles/${tile.x}/${tile.y}/lock`, {
        locked,
        updatedBy: state.user?.id ?? 'admin',
      });
    },
    [sendAdminPost, state.room?.id, state.user?.id],
  );

  const updateTileNoPickup = useCallback(
    async (tile: { x: number; y: number }, noPickup: boolean): Promise<boolean> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return false;
      }

      return sendAdminPost(`/admin/rooms/${roomId}/tiles/${tile.x}/${tile.y}/no-pickup`, {
        noPickup,
        updatedBy: state.user?.id ?? 'admin',
      });
    },
    [sendAdminPost, state.room?.id, state.user?.id],
  );

  const requestLatencyTrace = useCallback(async (): Promise<boolean> => {
    const roomId = state.room?.id;
    if (!roomId) {
      return false;
    }

    const userId = state.user?.id;
    const body = userId ? { requestedBy: userId } : {};
    return sendAdminPost(`/admin/rooms/${roomId}/latency-trace`, body);
  }, [sendAdminPost, state.room?.id, state.user?.id]);

  const spawnPlantAtTile = useCallback(
    async (tile: { x: number; y: number }): Promise<boolean> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return false;
      }

      return sendAdminPost(`/admin/rooms/${roomId}/items/plant`, {
        tileX: tile.x,
        tileY: tile.y,
        updatedBy: state.user?.id ?? 'admin',
      });
    },
    [sendAdminPost, state.room?.id, state.user?.id],
  );

  const fetchOccupantProfile = useCallback(
    async (occupantId: string): Promise<ActionResult<OccupantProfileSummary>> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return { ok: false, message: 'Room context unavailable', status: 400 };
      }

      return sendAuthorizedRequest(
        `/rooms/${roomId}/occupants/${occupantId}/profile`,
        { method: 'GET' },
        (payload) => occupantProfileResponseSchema.parse(payload).profile,
      );
    },
    [sendAuthorizedRequest, state.room?.id],
  );

  const initiateTradeWithOccupant = useCallback(
    async (occupantId: string): Promise<ActionResult<TradeSessionBootstrap>> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return { ok: false, message: 'Room context unavailable', status: 400 };
      }

      return sendAuthorizedRequest(
        `/rooms/${roomId}/occupants/${occupantId}/trade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: 'context_menu' }),
        },
        (payload) => tradeBootstrapResponseSchema.parse(payload),
      );
    },
    [sendAuthorizedRequest, state.room?.id],
  );

  const muteOccupant = useCallback(
    async (occupantId: string): Promise<ActionResult<MuteRecordSummary>> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return { ok: false, message: 'Room context unavailable', status: 400 };
      }

      return sendAuthorizedRequest(
        `/rooms/${roomId}/occupants/${occupantId}/mute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'context_menu' }),
        },
        (payload) => muteResponseSchema.parse(payload).mute,
      );
    },
    [sendAuthorizedRequest, state.room?.id],
  );

  const reportOccupant = useCallback(
    async (
      occupantId: string,
      reason: string = 'context_menu',
    ): Promise<ActionResult<ReportRecordSummary>> => {
      const roomId = state.room?.id;
      if (!roomId) {
        return { ok: false, message: 'Room context unavailable', status: 400 };
      }

      return sendAuthorizedRequest(
        `/rooms/${roomId}/occupants/${occupantId}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        },
        (payload) => reportResponseSchema.parse(payload).report,
      );
    },
    [sendAuthorizedRequest, state.room?.id],
  );

  return useMemo(
    () => ({
      ...state,
      sendMove,
      sendChat,
      sendPickup,
      clearPickupResult,
      updateTypingPreview,
      clearTypingPreview,
      updateShowSystemMessages,
      updateAdminAffordances,
      updateTileLock,
      updateTileNoPickup,
      requestLatencyTrace,
      spawnPlantAtTile,
      fetchOccupantProfile,
      initiateTradeWithOccupant,
      muteOccupant,
      reportOccupant,
    }),
    [
      state,
      sendMove,
      sendChat,
      sendPickup,
      clearPickupResult,
      updateTypingPreview,
      clearTypingPreview,
      updateShowSystemMessages,
      updateAdminAffordances,
      updateTileLock,
      updateTileNoPickup,
      requestLatencyTrace,
      spawnPlantAtTile,
      fetchOccupantProfile,
      initiateTradeWithOccupant,
      muteOccupant,
      reportOccupant,
    ],
  );
};
