import { useEffect, useRef, useState } from 'react';
import { messageEnvelopeSchema, type MessageEnvelope } from '@bitby/schemas';

const WS_SUBPROTOCOL = 'bitby.v1';
const DEFAULT_HEARTBEAT_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export type ConnectionStatus =
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting';

export interface RealtimeConnectionState {
  status: ConnectionStatus;
  lastError: string | null;
  retryInSeconds: number | null;
  heartbeatIntervalMs: number;
}

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

const resolveWebSocketUrl = (): string => {
  if (import.meta.env.VITE_BITBY_WS_URL) {
    return import.meta.env.VITE_BITBY_WS_URL;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.hostname}:3001/ws`;
};

export const useRealtimeConnection = (): RealtimeConnectionState => {
  const [state, setState] = useState<RealtimeConnectionState>({
    status: 'connecting',
    lastError: null,
    retryInSeconds: null,
    heartbeatIntervalMs: DEFAULT_HEARTBEAT_MS,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(1);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const disposedRef = useRef(false);

  useEffect(() => {
    const url = resolveWebSocketUrl();
    const token = import.meta.env.VITE_BITBY_DEV_TOKEN ?? 'local-development-token';

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

    const startPingTimer = (intervalMs: number) => {
      clearPingTimer();
      pingTimerRef.current = setInterval(() => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }

        const envelope = buildEnvelope(seqRef.current, 'ping', {
          clientTs: Date.now(),
        });
        seqRef.current += 1;
        socket.send(JSON.stringify(envelope));
      }, intervalMs);
    };

    const updateState = (partial: Partial<RealtimeConnectionState>) => {
      setState((previous) => ({
        ...previous,
        ...partial,
      }));
    };

    const handleEnvelope = (envelope: MessageEnvelope) => {
      switch (envelope.op) {
        case 'auth:ok': {
          const intervalFromServer =
            typeof envelope.data?.heartbeatIntervalMs === 'number'
              ? envelope.data.heartbeatIntervalMs
              : DEFAULT_HEARTBEAT_MS;

          updateState({
            status: 'connected',
            lastError: null,
            retryInSeconds: null,
            heartbeatIntervalMs: intervalFromServer,
          });
          startPingTimer(intervalFromServer);
          return;
        }
        case 'pong': {
          // Latency telemetry hooks will live here; keeping stub for future metrics.
          return;
        }
        case 'system:hello':
        case 'system:room_snapshot': {
          // Development scaffolding events; no client-side state yet.
          return;
        }
        default: {
          if (envelope.op.startsWith('error:')) {
            const message =
              typeof envelope.data?.message === 'string'
                ? envelope.data.message
                : 'Realtime error received';
            updateState({ lastError: message });
          }
        }
      }
    };

    const scheduleReconnect = () => {
      clearPingTimer();
      clearCountdownTimer();

      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);
      const retrySeconds = Math.max(1, Math.ceil(delay / 1000));

      updateState({
        status: 'reconnecting',
        retryInSeconds: retrySeconds,
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
        connect();
      }, delay);
    };

    const connect = () => {
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
      });

      const socket = new WebSocket(url, WS_SUBPROTOCOL);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (disposedRef.current) {
          socket.close(1000, 'Client disposed');
          return;
        }

        reconnectAttemptsRef.current = 0;
        updateState({ status: 'authenticating', lastError: null, retryInSeconds: null });

        const authEnvelope = buildEnvelope(seqRef.current, 'auth', { token });
        seqRef.current += 1;
        socket.send(JSON.stringify(authEnvelope));
      });

      socket.addEventListener('message', (event) => {
        if (disposedRef.current) {
          return;
        }

        if (typeof event.data !== 'string') {
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data);
        } catch (error) {
          updateState({ lastError: 'Received malformed JSON from server' });
          return;
        }

        const result = messageEnvelopeSchema.safeParse(parsed);
        if (!result.success) {
          updateState({ lastError: 'Server envelope validation failed' });
          return;
        }

        handleEnvelope(result.data);
      });

      socket.addEventListener('close', (event) => {
        if (disposedRef.current) {
          return;
        }

        const reason = event.reason || 'Connection closed';
        updateState({ lastError: `${reason} (code ${event.code})` });
        socketRef.current = null;
        scheduleReconnect();
      });

      socket.addEventListener('error', () => {
        if (disposedRef.current) {
          return;
        }

        updateState({ lastError: 'WebSocket transport error' });
      });
    };

    connect();

    return () => {
      disposedRef.current = true;
      clearPingTimer();
      clearCountdownTimer();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Client shutdown');
      }
    };
  }, []);

  return state;
};
