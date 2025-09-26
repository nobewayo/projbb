import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
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
  muteResponseSchema,
  reportResponseSchema,
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
});
