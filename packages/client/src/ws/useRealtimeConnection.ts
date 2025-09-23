import { useEffect, useRef, useState } from 'react';
import { messageEnvelopeSchema, type MessageEnvelope } from '@bitby/schemas';

const WS_SUBPROTOCOL = 'bitby.v1';
const DEFAULT_HEARTBEAT_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const LOGIN_USERNAME_FALLBACK = 'test';
const LOGIN_PASSWORD_FALLBACK = 'password123';

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
  const tokenRef = useRef<string | null>(getExplicitToken());
  const loginPromiseRef = useRef<Promise<string> | null>(null);
  const loginAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const url = resolveWebSocketUrl();

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

    const abortLogin = () => {
      if (loginAbortRef.current) {
        loginAbortRef.current.abort();
        loginAbortRef.current = null;
      }
      loginPromiseRef.current = null;
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

    const scheduleReconnect = () => {
      clearPingTimer();
      clearCountdownTimer();
      abortLogin();

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
        void connect();
      }, delay);
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
      });

      let token: string;
      try {
        token = await requestAuthToken();
      } catch (error) {
        if (disposedRef.current) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Failed to fetch auth token';
        updateState({ lastError: message });
        scheduleReconnect();
        return;
      }

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

        if (event.code === 4003 || event.code === 4401) {
          tokenRef.current = null;
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

    void connect();

    return () => {
      disposedRef.current = true;
      clearPingTimer();
      clearCountdownTimer();
      abortLogin();
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
