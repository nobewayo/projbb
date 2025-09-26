import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  adminTileFlagUpdateDataSchema,
  chatMessageBroadcastSchema,
  chatTypingBroadcastSchema,
  chatTypingUpdateDataSchema,
  itemPickupOkDataSchema,
  messageEnvelopeSchema,
  moveOkDataSchema,
  roomOccupantLeftDataSchema,
  roomOccupantMovedDataSchema,
  occupantProfileResponseSchema,
  tradeBootstrapResponseSchema,
  tradeLifecycleResponseSchema,
  tradeLifecycleBroadcastSchema,
  muteResponseSchema,
  reportResponseSchema,
  socialStateSchema,
  socialMuteBroadcastSchema,
  socialReportBroadcastSchema,
  type MessageEnvelope,
} from '@bitby/schemas';
import type { FastifyInstance } from 'fastify';
import { loadConfig, type ServerConfig } from '../config.js';
import { createServer } from '../server.js';
import { createReadinessController } from '../readiness.js';
import { startTestStack, type TestStack } from './helpers/testStack.js';
import { createPgPool } from '../db/pool.js';
import { runMigrations } from '../db/migrations.js';

const PLANT_ITEM_ID = '11111111-1111-1111-1111-222222222201';
const DEV_ROOM_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_USER_ID = '11111111-1111-1111-1111-111111111201';
const HEARTBEAT_PING_OP = 'ping';
const HEARTBEAT_PONG_OP = 'pong';

interface Waiter {
  predicate: (envelope: MessageEnvelope) => boolean;
  resolve: (envelope: MessageEnvelope) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const toEnvelope = (raw: unknown): MessageEnvelope => {
  const candidate = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const parsed = messageEnvelopeSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Received invalid envelope: ${parsed.error.message}`);
  }

  return parsed.data;
};

class RealtimeTestClient {
  private readonly label: string;
  private readonly baseUrl: string;
  private readonly socket: Socket;
  private seq = 1;
  private readonly messages: MessageEnvelope[] = [];
  private waiters: Waiter[] = [];
  private connected = false;

  public userId: string | null = null;
  public username: string | null = null;
  public heartbeatIntervalMs: number | null = null;

  constructor(label: string, baseUrl: string) {
    this.label = label;
    this.baseUrl = baseUrl;
    this.socket = io(this.baseUrl, {
      autoConnect: false,
      forceNew: true,
      path: '/ws',
      transports: ['websocket'],
      reconnection: false,
    });

    this.socket.on('message', (raw) => {
      const envelope = toEnvelope(raw);
      this.messages.push(envelope);
      for (const waiter of [...this.waiters]) {
        if (waiter.predicate(envelope)) {
          this.clearWaiter(waiter);
          waiter.resolve(envelope);
        }
      }
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      for (const waiter of [...this.waiters]) {
        this.clearWaiter(waiter);
        waiter.reject(new Error(`${this.label} disconnected before receiving envelope`));
      }
      this.waiters = [];
    });
  }

  private clearWaiter(waiter: Waiter): void {
    clearTimeout(waiter.timeout);
    this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
  }

  async connectAndAuthenticate(token: string): Promise<MessageEnvelope> {
    if (this.connected) {
      throw new Error(`${this.label} already connected`);
    }

    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', () => {
        this.connected = true;
        resolve();
      });
      this.socket.once('connect_error', (error) => {
        reject(error);
      });
      this.socket.connect();
    });

    const authSeq = this.send('auth', { token });
    const authOk = await this.waitFor((envelope) => envelope.op === 'auth:ok' && envelope.seq === authSeq, 10_000);

    const data = authOk.data as {
      user?: { id?: string; username?: string };
      heartbeatIntervalMs?: number;
    };

    if (!data.user?.id || !data.user.username) {
      throw new Error('auth:ok payload missing user information');
    }

    this.userId = data.user.id;
    this.username = data.user.username;
    this.heartbeatIntervalMs = data.heartbeatIntervalMs ?? null;

    return authOk;
  }

  send(op: string, data: Record<string, unknown> = {}): number {
    if (!this.connected) {
      throw new Error(`${this.label} is not connected`);
    }

    const envelope: MessageEnvelope = {
      op,
      seq: this.seq++,
      ts: nowSeconds(),
      data,
    };

    this.socket.emit('message', envelope);
    return envelope.seq;
  }

  async sendAndAwaitAck(
    op: string,
    data: Record<string, unknown>,
    ackOp: string,
    timeoutMs = 5_000,
    options: { errorOps?: string[] } = {},
  ): Promise<MessageEnvelope> {
    const seq = this.send(op, data);
    const envelope = await this.waitFor(
      (message) =>
        message.seq === seq &&
        (message.op === ackOp || (options.errorOps?.includes(message.op) ?? false)),
      timeoutMs,
      `${ackOp} acknowledgement`,
    );

    if (envelope.op !== ackOp) {
      throw new Error(
        `Received ${envelope.op} while waiting for ${ackOp} on ${this.label}: ${JSON.stringify(envelope.data)}`,
      );
    }

    return envelope;
  }

  waitFor(
    predicate: (envelope: MessageEnvelope) => boolean,
    timeoutMs = 5_000,
    label = 'realtime envelope',
  ): Promise<MessageEnvelope> {
    const existing = this.messages.find((message) => predicate(message));
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise<MessageEnvelope>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((candidate) => candidate.timeout !== timeout);
        reject(new Error(`Timed out waiting for ${label} on ${this.label}`));
      }, timeoutMs);

      const waiter: Waiter = {
        predicate,
        resolve,
        reject,
        timeout,
      };

      this.waiters.push(waiter);
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.socket.once('disconnect', () => {
        resolve();
      });
      this.socket.disconnect();
    });
  }
}

describe.sequential('realtime integration', () => {
  let stack: TestStack;
  let config: ServerConfig;
  let app: FastifyInstance;
  let httpBaseUrl: string;
  let clients: RealtimeTestClient[] = [];

  beforeAll(async () => {
    stack = await startTestStack();
    config = loadConfig({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3001',
      CLIENT_ORIGIN: 'http://localhost:5173',
      PGHOST: stack.config.pg.host,
      PGPORT: String(stack.config.pg.port),
      PGDATABASE: stack.config.pg.database,
      PGUSER: stack.config.pg.user,
      PGPASSWORD: stack.config.pg.password,
      REDIS_URL: stack.config.redisUrl,
      JWT_SECRET: 'integration-test-secret',
    });

    const pool = createPgPool(config);
    await runMigrations(pool);
    await pool.end();
  });

  afterAll(async () => {
    await stack.stop();
  });

  beforeEach(async () => {
    clients = [];
    await stack.flush();

    const pool = createPgPool(config);
    await pool.query('DELETE FROM chat_message');
    await pool.query('DELETE FROM user_inventory_item');
    await pool.query('DELETE FROM user_mute');
    await pool.query('DELETE FROM user_report');
    await pool.query('DELETE FROM trade_session');
    await pool.query('DELETE FROM audit_log');
    await pool.query('UPDATE room_item SET picked_up_at = NULL, picked_up_by = NULL');
    await pool.query(
      `UPDATE room_avatar SET room_id = NULL WHERE user_id = '11111111-1111-1111-1111-111111111299'`,
    );
    await pool.end();

    const readiness = createReadinessController();
    app = await createServer({ config, readiness });
    await app.listen({ host: config.HOST, port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to determine server address for tests');
    }

    const host = address.address === '::' ? '127.0.0.1' : address.address;
    httpBaseUrl = `http://${host}:${address.port}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      await client.disconnect();
    }
    clients = [];

    if (app) {
      await app.close();
    }
  });

  const login = async (username: string, password = 'password123'): Promise<string> => {
    const response = await fetch(`${httpBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { token: string };
    return json.token;
  };

  const createAuthedClient = async (username: string): Promise<RealtimeTestClient> => {
    const token = await login(username);
    const client = new RealtimeTestClient(username, httpBaseUrl);
    await client.connectAndAuthenticate(token);
    clients.push(client);
    return client;
  };

  it('relays typing indicators and chat messages between clients', async () => {
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    const typingAck = await alice.sendAndAwaitAck(
      'chat:typing',
      chatTypingUpdateDataSchema.parse({
        isTyping: true,
        preview: 'brb',
      }),
      'chat:typing:ok',
      5_000,
      { errorOps: ['error:chat_typing_payload'] },
    );

    const typingData = chatTypingBroadcastSchema.parse(
      (await bob.waitFor((message) => message.op === 'chat:typing')).data,
    );

    expect(typingData.userId).toBe(alice.userId);
    expect(typingData.isTyping).toBe(true);
    expect(typingData.preview).toBe('brb');
    expect(typeof typingAck.data).toBe('object');

    await alice.sendAndAwaitAck(
      'chat:typing',
      { isTyping: false },
      'chat:typing:ok',
      5_000,
      { errorOps: ['error:chat_typing_payload'] },
    );

    const chatBody = 'integration::hello-world';
    const chatAck = await alice.sendAndAwaitAck(
      'chat:send',
      { body: chatBody },
      'chat:ok',
      5_000,
      { errorOps: ['error:chat_payload'] },
    );

    const chatAckData = chatAck.data as { messageId?: string };
    expect(typeof chatAckData.messageId).toBe('string');

    const chatBroadcastEnvelope = await alice.waitFor(
      (message) =>
        message.op === 'chat:new' &&
        (message.data as { id?: string }).id === chatAckData.messageId,
    );

    const chatBroadcast = chatMessageBroadcastSchema.parse(chatBroadcastEnvelope.data);

    expect(chatBroadcast.body).toBe(chatBody);
    expect(chatBroadcast.userId).toBe(alice.userId);

    const chatEchoEnvelope = await bob.waitFor(
      (message) =>
        message.op === 'chat:new' &&
        (message.data as { id?: string }).id === chatBroadcast.id,
    );

    const chatEcho = chatMessageBroadcastSchema.parse(chatEchoEnvelope.data);

    expect(chatEcho.id).toBe(chatBroadcast.id);
    expect(chatEcho.body).toBe(chatBody);
  });

  it('responds to heartbeat pings and cleans up on reconnect', async () => {
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.heartbeatIntervalMs).toBeGreaterThan(0);

    const pong = await alice.sendAndAwaitAck(HEARTBEAT_PING_OP, {}, HEARTBEAT_PONG_OP);
    const pongData = pong.data as { serverTs?: number };
    expect(typeof pongData.serverTs).toBe('number');

    const aliceId = alice.userId;
    expect(aliceId).toBeTruthy();

    await alice.disconnect();

    const leftData = roomOccupantLeftDataSchema.parse(
      (await bob.waitFor((message) => message.op === 'room:occupant_left')).data,
    );
    expect(leftData.occupantId).toBe(aliceId);

    const aliceReconnect = await createAuthedClient('test');

    const moveData = roomOccupantMovedDataSchema.parse(
      (await bob.waitFor(
        (message) =>
          message.op === 'room:occupant_moved' &&
          (message.data as { occupant?: { id?: string } }).occupant?.id === aliceReconnect.userId,
      )).data,
    );

    expect(moveData.occupant.id).toBe(aliceReconnect.userId);
  });

  it('moves avatars and distributes item pickups across the room', async () => {
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test3');

    const moveAck = await alice.sendAndAwaitAck('move', { x: 6, y: 4 }, 'move:ok', 5_000, {
      errorOps: ['move:err'],
    });
    const moveData = moveOkDataSchema.parse(moveAck.data);
    expect(moveData.x).toBe(6);
    expect(moveData.y).toBe(4);

    const broadcastMove = roomOccupantMovedDataSchema.parse(
      (
        await bob.waitFor(
          (message) =>
            message.op === 'room:occupant_moved' &&
            (message.data as { occupant?: { id?: string } }).occupant?.id === alice.userId,
          5_000,
          'room:occupant_moved broadcast',
        )
      ).data,
    );

    expect(broadcastMove.occupant.position).toEqual({ x: 6, y: 4 });

    const pickupAck = await alice.sendAndAwaitAck(
      'item:pickup',
      { itemId: PLANT_ITEM_ID },
      'item:pickup:ok',
      10_000,
      { errorOps: ['item:pickup:err'] },
    );

    const pickupData = itemPickupOkDataSchema.parse(pickupAck.data);
    expect(pickupData.itemId).toBe(PLANT_ITEM_ID);
    expect(pickupData.inventoryItem.roomItemId).toBe(PLANT_ITEM_ID);

    expect(alice.userId).not.toBeNull();
    const db = createPgPool(config);
    try {
      const inventoryResult = await db.query<{ room_item_id: string }>(
        `SELECT room_item_id FROM user_inventory_item WHERE user_id = $1 AND room_item_id = $2 LIMIT 1`,
        [alice.userId, PLANT_ITEM_ID],
      );
      expect(inventoryResult.rowCount).toBe(1);

      const itemResult = await db.query<{ picked_up_by: string | null }>(
        `SELECT picked_up_by FROM room_item WHERE id = $1 LIMIT 1`,
        [PLANT_ITEM_ID],
      );
      expect(itemResult.rowCount).toBe(1);
      expect(itemResult.rows[0]?.picked_up_by).toBe(alice.userId);
    } finally {
      await db.end();
    }
  });

  it('enforces admin auth, broadcasts tile locks, and writes audit logs', async () => {
    const observer = await createAuthedClient('test2');
    const ownerToken = await login('test');
    const regularToken = await login('test4');

    const endpoint = `${httpBaseUrl}/admin/rooms/${DEV_ROOM_ID}/tiles/1/1/lock`;

    const unauthenticated = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: true }),
    });
    expect(unauthenticated.status).toBe(401);

    const forbidden = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`,
      },
      body: JSON.stringify({ locked: true }),
    });
    expect(forbidden.status).toBe(403);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ locked: true }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { tile?: { locked?: boolean } };
    expect(json.tile?.locked).toBe(true);

    const updateEnvelope = await observer.waitFor(
      (message) => message.op === 'admin:tile_flag:update',
      5_000,
    );
    const update = adminTileFlagUpdateDataSchema.parse(updateEnvelope.data);
    expect(update.tile.locked).toBe(true);
    expect(update.updatedBy).toBe('test');

    const db = createPgPool(config);
    try {
      const auditResult = await db.query<{
        user_id: string;
        room_id: string | null;
        action: string;
        ctx: Record<string, unknown>;
      }>(
        `SELECT user_id, room_id, action, ctx
           FROM audit_log
          ORDER BY created_at DESC, id DESC
          LIMIT 1`,
      );

      expect(auditResult.rowCount).toBe(1);
      const auditRow = auditResult.rows[0];
      expect(auditRow.user_id).toBe(OWNER_USER_ID);
      expect(auditRow.room_id).toBe(DEV_ROOM_ID);
      expect(auditRow.action).toBe('admin.tile.lock');

      const context = auditRow.ctx;
      expect(context.locked).toBe(true);
      const tileContext = context.tile as { x?: number; y?: number } | undefined;
      expect(tileContext?.x).toBe(1);
      expect(tileContext?.y).toBe(1);

      await db.query(
        `INSERT INTO room_tile_flag (room_id, x, y, locked, no_pickup)
           VALUES ($1, $2, $3, false, false)
           ON CONFLICT (room_id, x, y) DO UPDATE
             SET locked = EXCLUDED.locked`,
        [DEV_ROOM_ID, 1, 1],
      );
    } finally {
      await db.end();
    }
  });

  it('returns occupant profile summaries over REST', async () => {
    const token = await login('test');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const response = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/profile`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const parsed = occupantProfileResponseSchema.parse(payload);

    expect(parsed.profile.id).toBe(bob.userId);
    expect(parsed.profile.room.id).toBe(DEV_ROOM_ID);
    expect(parsed.profile.username).toBe('test2');
    expect(parsed.profile.inventoryCount).toBeGreaterThanOrEqual(0);
  });

  it('creates trade sessions via the occupant trade endpoint', async () => {
    const token = await login('test');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const response = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/trade`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ context: 'context_menu' }),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const parsed = tradeBootstrapResponseSchema.parse(payload);

    expect(parsed.trade.initiatorId).toBe(alice.userId);
    expect(parsed.trade.recipientId).toBe(bob.userId);
    expect(parsed.trade.roomId).toBe(DEV_ROOM_ID);

    const initiatorPendingEnvelope = await alice.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsedEnvelope = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return (
          parsedEnvelope.success &&
          parsedEnvelope.data.trade.id === parsed.trade.id &&
          parsedEnvelope.data.trade.status === 'pending'
        );
      },
      5_000,
      'trade pending broadcast (initiator)',
    );
    const initiatorPending = tradeLifecycleBroadcastSchema.parse(initiatorPendingEnvelope.data);
    expect(initiatorPending.participant.id).toBe(bob.userId);
    expect(initiatorPending.trade.status).toBe('pending');
    expect(initiatorPending.actorId).toBe(alice.userId);

    const recipientPendingEnvelope = await bob.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsedEnvelope = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return (
          parsedEnvelope.success &&
          parsedEnvelope.data.trade.id === parsed.trade.id &&
          parsedEnvelope.data.trade.status === 'pending'
        );
      },
      5_000,
      'trade pending broadcast (recipient)',
    );
    const recipientPending = tradeLifecycleBroadcastSchema.parse(recipientPendingEnvelope.data);
    expect(recipientPending.participant.id).toBe(alice.userId);
    expect(recipientPending.trade.status).toBe('pending');
    expect(recipientPending.actorId).toBe(alice.userId);
  });

  it('allows a recipient to accept and complete a trade session', async () => {
    const initiatorToken = await login('test');
    const recipientToken = await login('test2');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const bootstrapResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/trade`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initiatorToken}`,
        },
        body: JSON.stringify({ context: 'context_menu' }),
      },
    );

    expect(bootstrapResponse.status).toBe(200);
    const bootstrapPayload = await bootstrapResponse.json();
    const bootstrap = tradeBootstrapResponseSchema.parse(bootstrapPayload);

    const acceptResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/trades/${bootstrap.trade.id}/accept`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${recipientToken}`,
        },
      },
    );

    expect(acceptResponse.status).toBe(200);
    const acceptPayload = await acceptResponse.json();
    const accepted = tradeLifecycleResponseSchema.parse(acceptPayload);

    expect(accepted.trade.status).toBe('accepted');
    expect(accepted.trade.acceptedAt).toBeDefined();
    expect(accepted.participant.id).toBe(alice.userId);

    const initiatorAcceptEnvelope = await alice.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return parsed.success && parsed.data.trade.id === bootstrap.trade.id && parsed.data.trade.status === 'accepted';
      },
      5_000,
      'trade accepted broadcast (initiator)',
    );
    const initiatorAccept = tradeLifecycleBroadcastSchema.parse(initiatorAcceptEnvelope.data);
    expect(initiatorAccept.participant.id).toBe(bob.userId);
    expect(initiatorAccept.actorId).toBe(bob.userId);

    const recipientAcceptEnvelope = await bob.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return parsed.success && parsed.data.trade.id === bootstrap.trade.id && parsed.data.trade.status === 'accepted';
      },
      5_000,
      'trade accepted broadcast (recipient)',
    );
    const recipientAccept = tradeLifecycleBroadcastSchema.parse(recipientAcceptEnvelope.data);
    expect(recipientAccept.participant.id).toBe(alice.userId);
    expect(recipientAccept.actorId).toBe(bob.userId);

    const completeResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/trades/${bootstrap.trade.id}/complete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${initiatorToken}`,
        },
      },
    );

    expect(completeResponse.status).toBe(200);
    const completePayload = await completeResponse.json();
    const completed = tradeLifecycleResponseSchema.parse(completePayload);

    expect(completed.trade.status).toBe('completed');
    expect(completed.trade.completedAt).toBeDefined();
    expect(completed.participant.id).toBe(bob.userId);

    const initiatorCompleteEnvelope = await alice.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return parsed.success && parsed.data.trade.id === bootstrap.trade.id && parsed.data.trade.status === 'completed';
      },
      5_000,
      'trade completed broadcast (initiator)',
    );
    const initiatorComplete = tradeLifecycleBroadcastSchema.parse(initiatorCompleteEnvelope.data);
    expect(initiatorComplete.participant.id).toBe(bob.userId);
    expect(initiatorComplete.actorId).toBe(alice.userId);

    const recipientCompleteEnvelope = await bob.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return parsed.success && parsed.data.trade.id === bootstrap.trade.id && parsed.data.trade.status === 'completed';
      },
      5_000,
      'trade completed broadcast (recipient)',
    );
    const recipientComplete = tradeLifecycleBroadcastSchema.parse(recipientCompleteEnvelope.data);
    expect(recipientComplete.participant.id).toBe(alice.userId);
    expect(recipientComplete.actorId).toBe(alice.userId);
  });

  it('supports cancelling trade sessions with explicit reasons', async () => {
    const initiatorToken = await login('test');
    const recipientToken = await login('test2');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const bootstrapResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/trade`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initiatorToken}`,
        },
        body: JSON.stringify({ context: 'context_menu' }),
      },
    );

    expect(bootstrapResponse.status).toBe(200);
    const bootstrapPayload = await bootstrapResponse.json();
    const bootstrap = tradeBootstrapResponseSchema.parse(bootstrapPayload);

    const declineResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/trades/${bootstrap.trade.id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${recipientToken}`,
        },
        body: JSON.stringify({ reason: 'declined' }),
      },
    );

    expect(declineResponse.status).toBe(200);
    const declinePayload = await declineResponse.json();
    const cancelled = tradeLifecycleResponseSchema.parse(declinePayload);

    expect(cancelled.trade.status).toBe('cancelled');
    expect(cancelled.trade.cancelledReason).toBe('declined');
    expect(cancelled.trade.cancelledBy).toBe(bob.userId);
    expect(cancelled.participant.id).toBe(alice.userId);

    const initiatorCancelEnvelope = await alice.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return parsed.success && parsed.data.trade.id === bootstrap.trade.id && parsed.data.trade.status === 'cancelled';
      },
      5_000,
      'trade cancelled broadcast (initiator)',
    );
    const initiatorCancel = tradeLifecycleBroadcastSchema.parse(initiatorCancelEnvelope.data);
    expect(initiatorCancel.participant.id).toBe(bob.userId);
    expect(initiatorCancel.actorId).toBe(bob.userId);

    const recipientCancelEnvelope = await bob.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return parsed.success && parsed.data.trade.id === bootstrap.trade.id && parsed.data.trade.status === 'cancelled';
      },
      5_000,
      'trade cancelled broadcast (recipient)',
    );
    const recipientCancel = tradeLifecycleBroadcastSchema.parse(recipientCancelEnvelope.data);
    expect(recipientCancel.participant.id).toBe(alice.userId);
    expect(recipientCancel.actorId).toBe(bob.userId);
  });

  it('hydrates the latest trade lifecycle state on reconnect', async () => {
    const initiatorToken = await login('test');
    const recipientToken = await login('test2');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const bootstrapResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/trade`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${initiatorToken}`,
        },
        body: JSON.stringify({ context: 'context_menu' }),
      },
    );

    expect(bootstrapResponse.status).toBe(200);
    const bootstrapPayload = await bootstrapResponse.json();
    const bootstrap = tradeBootstrapResponseSchema.parse(bootstrapPayload);

    await alice.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return (
          parsed.success &&
          parsed.data.trade.id === bootstrap.trade.id &&
          parsed.data.trade.status === 'pending'
        );
      },
      5_000,
      'pending trade broadcast (initiator hydration)',
    );

    await bob.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return (
          parsed.success &&
          parsed.data.trade.id === bootstrap.trade.id &&
          parsed.data.trade.status === 'pending'
        );
      },
      5_000,
      'pending trade broadcast (recipient hydration)',
    );

    await alice.disconnect();

    const reconnectToken = await login('test');
    const aliceReconnect = new RealtimeTestClient('test', httpBaseUrl);
    clients.push(aliceReconnect);
    const reconnectEnvelope = await aliceReconnect.connectAndAuthenticate(reconnectToken);
    const reconnectPayload = (reconnectEnvelope.data ?? {}) as { tradeLifecycle?: unknown };
    expect(reconnectPayload.tradeLifecycle).not.toBeNull();
    const reconnectTrade = tradeLifecycleBroadcastSchema.parse(
      reconnectPayload.tradeLifecycle as Record<string, unknown>,
    );
    expect(reconnectTrade.trade.id).toBe(bootstrap.trade.id);
    expect(reconnectTrade.trade.status).toBe('pending');
    expect(reconnectTrade.participant.id).toBe(bob.userId);

    const cancelResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/trades/${bootstrap.trade.id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${recipientToken}`,
        },
        body: JSON.stringify({ reason: 'declined' }),
      },
    );

    expect(cancelResponse.status).toBe(200);

    const cancelEnvelope = await aliceReconnect.waitFor(
      (message) => {
        if (message.op !== 'trade:lifecycle:update') {
          return false;
        }
        const parsed = tradeLifecycleBroadcastSchema.safeParse(message.data);
        return (
          parsed.success &&
          parsed.data.trade.id === bootstrap.trade.id &&
          parsed.data.trade.status === 'cancelled'
        );
      },
      5_000,
      'trade cancelled broadcast (initiator reconnect)',
    );
    const cancelBroadcast = tradeLifecycleBroadcastSchema.parse(cancelEnvelope.data);
    expect(cancelBroadcast.trade.cancelledReason).toBe('declined');
    expect(cancelBroadcast.trade.cancelledBy).toBe(bob.userId);

    await bob.disconnect();

    const recipientReconnectToken = await login('test2');
    const bobReconnect = new RealtimeTestClient('test2', httpBaseUrl);
    clients.push(bobReconnect);
    const bobReconnectEnvelope = await bobReconnect.connectAndAuthenticate(recipientReconnectToken);
    const bobReconnectPayload = (bobReconnectEnvelope.data ?? {}) as { tradeLifecycle?: unknown };
    expect(bobReconnectPayload.tradeLifecycle).not.toBeNull();
    const cancelledHydration = tradeLifecycleBroadcastSchema.parse(
      bobReconnectPayload.tradeLifecycle as Record<string, unknown>,
    );
    expect(cancelledHydration.trade.id).toBe(bootstrap.trade.id);
    expect(cancelledHydration.trade.status).toBe('cancelled');
    expect(cancelledHydration.trade.cancelledBy).toBe(bob.userId);
  });

  it('records mute requests for occupants', async () => {
    const token = await login('test');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const response = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/mute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'integration-test' }),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const parsed = muteResponseSchema.parse(payload);

    expect(parsed.mute.userId).toBe(alice.userId);
    expect(parsed.mute.mutedUserId).toBe(bob.userId);
    expect(parsed.mute.roomId).toBe(DEV_ROOM_ID);
  });

  it('submits occupant reports', async () => {
    const token = await login('test');
    const alice = await createAuthedClient('test');
    const bob = await createAuthedClient('test2');

    expect(alice.userId).not.toBeNull();
    expect(bob.userId).not.toBeNull();

    const response = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'integration-test-report' }),
      },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const parsed = reportResponseSchema.parse(payload);

    expect(parsed.report.reporterId).toBe(alice.userId);
    expect(parsed.report.reportedUserId).toBe(bob.userId);
    expect(parsed.report.roomId).toBe(DEV_ROOM_ID);
    expect(parsed.report.reason).toBe('integration-test-report');
  });

  it('hydrates mute history on auth and broadcasts new mute records', async () => {
    const token = await login('test');
    const alice = new RealtimeTestClient('test', httpBaseUrl);
    clients.push(alice);
    const authEnvelope = await alice.connectAndAuthenticate(token);
    const initialSocial = socialStateSchema.parse(
      ((authEnvelope.data ?? {}) as { social?: unknown }).social ?? { mutes: [], reports: [] },
    );
    expect(initialSocial.mutes).toHaveLength(0);

    const bob = await createAuthedClient('test2');
    expect(bob.userId).not.toBeNull();

    const muteResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/mute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'integration-test-social-mute' }),
      },
    );

    expect(muteResponse.status).toBe(200);

    const updateEnvelope = await alice.waitFor(
      (message) => message.op === 'social:mute:recorded',
      5_000,
      'social mute broadcast',
    );
    const broadcast = socialMuteBroadcastSchema.parse(updateEnvelope.data);
    expect(broadcast.mute.mutedUserId).toBe(bob.userId);
    expect(broadcast.mute.userId).toBe(alice.userId);

    await alice.disconnect();

    const reconnectToken = await login('test');
    const aliceReconnect = new RealtimeTestClient('test', httpBaseUrl);
    clients.push(aliceReconnect);
    const reconnectEnvelope = await aliceReconnect.connectAndAuthenticate(reconnectToken);
    const reconnectSocial = socialStateSchema.parse(
      ((reconnectEnvelope.data ?? {}) as { social?: unknown }).social ?? { mutes: [], reports: [] },
    );
    expect(
      reconnectSocial.mutes.some((entry) => entry.mutedUserId === bob.userId && entry.userId === alice.userId),
    ).toBe(true);
  });

  it('hydrates report history on auth and broadcasts new reports', async () => {
    const token = await login('test');
    const alice = new RealtimeTestClient('test', httpBaseUrl);
    clients.push(alice);
    const authEnvelope = await alice.connectAndAuthenticate(token);
    const initialSocial = socialStateSchema.parse(
      ((authEnvelope.data ?? {}) as { social?: unknown }).social ?? { mutes: [], reports: [] },
    );
    expect(initialSocial.reports).toHaveLength(0);

    const bob = await createAuthedClient('test2');
    expect(bob.userId).not.toBeNull();

    const reportResponse = await fetch(
      `${httpBaseUrl}/rooms/${DEV_ROOM_ID}/occupants/${bob.userId}/report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'integration-test-social-report' }),
      },
    );

    expect(reportResponse.status).toBe(200);

    const updateEnvelope = await alice.waitFor(
      (message) => message.op === 'social:report:recorded',
      5_000,
      'social report broadcast',
    );
    const broadcast = socialReportBroadcastSchema.parse(updateEnvelope.data);
    expect(broadcast.report.reportedUserId).toBe(bob.userId);
    expect(broadcast.report.reporterId).toBe(alice.userId);

    await alice.disconnect();

    const reconnectToken = await login('test');
    const aliceReconnect = new RealtimeTestClient('test', httpBaseUrl);
    clients.push(aliceReconnect);
    const reconnectEnvelope = await aliceReconnect.connectAndAuthenticate(reconnectToken);
    const reconnectSocial = socialStateSchema.parse(
      ((reconnectEnvelope.data ?? {}) as { social?: unknown }).social ?? { mutes: [], reports: [] },
    );
    expect(
      reconnectSocial.reports.some(
        (entry) => entry.reportedUserId === bob.userId && entry.reporterId === alice.userId,
      ),
    ).toBe(true);
  });

  it('prunes chat history to retain the latest 200 messages', async () => {
    const alice = await createAuthedClient('test');

    const totalMessages = 205;
    for (let index = 0; index < totalMessages; index += 1) {
      await alice.sendAndAwaitAck(
        'chat:send',
        { body: `retention-${index}` },
        'chat:ok',
        5_000,
        { errorOps: ['error:chat_payload'] },
      );
    }

    const retentionPool = createPgPool(config);
    try {
      const countResult = await retentionPool.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM chat_message WHERE room_id = $1',
        [DEV_ROOM_ID],
      );
      expect(countResult.rows[0]?.count ?? 0).toBeLessThanOrEqual(200);
    } finally {
      await retentionPool.end();
    }

    const reconnectToken = await login('test3');
    const reconnectClient = new RealtimeTestClient('test3', httpBaseUrl);
    clients.push(reconnectClient);
    const reconnectEnvelope = await reconnectClient.connectAndAuthenticate(reconnectToken);
    const chatHistoryRaw = Array.isArray(reconnectEnvelope.data?.chatHistory)
      ? (reconnectEnvelope.data.chatHistory as unknown[])
      : [];
    expect(chatHistoryRaw.length).toBeLessThanOrEqual(200);
    expect(chatHistoryRaw.length).toBeGreaterThan(0);
    const lastEntry = chatMessageBroadcastSchema.parse(
      chatHistoryRaw[chatHistoryRaw.length - 1] ?? {},
    );
    expect(lastEntry.body.startsWith('retention-')).toBe(true);
  });
});
