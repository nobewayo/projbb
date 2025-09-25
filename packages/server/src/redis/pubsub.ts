import { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import type { AdminQuickMenuState } from '@bitby/schemas';
import type { ServerConfig } from '../config.js';

const ROOM_CHAT_CHANNEL = (roomId: string): string => `room.${roomId}.chat`;
const ROOM_ADMIN_CHANNEL = (roomId: string): string => `room.${roomId}.admin`;

export type RoomChatEvent =
  | {
      type: 'chat:new';
      roomId: string;
      payload: {
        id: string;
        userId: string;
        username: string;
        roles: string[];
        body: string;
        createdAt: string;
        roomSeq: number;
      };
    }
  | {
      type: 'chat:typing';
      roomId: string;
      payload: {
        userId: string;
        isTyping: boolean;
        preview?: string;
        expiresAt?: string;
      };
    };

export type RoomAdminEvent = {
  type: 'admin:state';
  roomId: string;
  payload: AdminQuickMenuState;
};

export interface RoomPubSub {
  publishChat(event: RoomChatEvent): Promise<void>;
  subscribeToChat(roomId: string, handler: (event: RoomChatEvent) => void): Promise<void>;
  publishAdminState(event: RoomAdminEvent): Promise<void>;
  subscribeToAdminState(
    roomId: string,
    handler: (event: RoomAdminEvent) => void,
  ): Promise<void>;
  close(): Promise<void>;
}

interface PubSubMessage {
  origin: string;
  event: RoomChatEvent | RoomAdminEvent;
}

export const createRoomPubSub = async ({
  config,
  logger,
  instanceId,
}: {
  config: ServerConfig;
  logger: FastifyBaseLogger;
  instanceId: string;
}): Promise<RoomPubSub> => {
  const publisher = new Redis(config.REDIS_URL, { lazyConnect: true });
  const subscriber = new Redis(config.REDIS_URL, { lazyConnect: true });
  const messageListeners = new Map<string, (channel: string, payload: string) => void>();
  const chatChannelHandlers = new Map<string, Set<(event: RoomChatEvent) => void>>();
  const adminChannelHandlers = new Map<string, Set<(event: RoomAdminEvent) => void>>();

  publisher.on('error', (error: unknown) => {
    logger.error({ err: error }, 'Redis publisher error');
  });
  subscriber.on('error', (error: unknown) => {
    logger.error({ err: error }, 'Redis subscriber error');
  });

  await publisher.connect();
  await subscriber.connect();

  const publishChat = async (event: RoomChatEvent): Promise<void> => {
    const payload: PubSubMessage = { origin: instanceId, event };
    await publisher.publish(ROOM_CHAT_CHANNEL(event.roomId), JSON.stringify(payload));
  };

  const subscribeToChat = async (
    roomId: string,
    handler: (event: RoomChatEvent) => void,
  ): Promise<void> => {
    const channel = ROOM_CHAT_CHANNEL(roomId);
    let handlers = chatChannelHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      chatChannelHandlers.set(channel, handlers);

      const listener = (incomingChannel: string, payload: string) => {
        if (incomingChannel !== channel) {
          return;
        }

        try {
          const parsed = JSON.parse(payload) as PubSubMessage;
          if (!parsed || typeof parsed !== 'object') {
            return;
          }

          if (parsed.origin === instanceId) {
            return;
          }

          const currentHandlers = chatChannelHandlers.get(channel);
          if (!currentHandlers || currentHandlers.size === 0) {
            return;
          }

          if (parsed.event.type !== 'chat:new' && parsed.event.type !== 'chat:typing') {
            return;
          }

          for (const fn of currentHandlers) {
            fn(parsed.event);
          }
        } catch (error) {
          logger.error({ err: error }, 'Failed to parse chat pubsub payload');
        }
      };

      messageListeners.set(channel, listener);
      subscriber.on('message', listener);
    }

    handlers.add(handler);
    await subscriber.subscribe(channel);
  };

  const publishAdminState = async (event: RoomAdminEvent): Promise<void> => {
    const payload: PubSubMessage = { origin: instanceId, event };
    await publisher.publish(ROOM_ADMIN_CHANNEL(event.roomId), JSON.stringify(payload));
  };

  const subscribeToAdminState = async (
    roomId: string,
    handler: (event: RoomAdminEvent) => void,
  ): Promise<void> => {
    const channel = ROOM_ADMIN_CHANNEL(roomId);
    let handlers = adminChannelHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      adminChannelHandlers.set(channel, handlers);

      const listener = (incomingChannel: string, payload: string) => {
        if (incomingChannel !== channel) {
          return;
        }

        try {
          const parsed = JSON.parse(payload) as PubSubMessage;
          if (!parsed || typeof parsed !== 'object') {
            return;
          }

          if (parsed.origin === instanceId) {
            return;
          }

          const currentHandlers = adminChannelHandlers.get(channel);
          if (!currentHandlers || currentHandlers.size === 0) {
            return;
          }

          if (parsed.event.type !== 'admin:state') {
            return;
          }

          for (const fn of currentHandlers) {
            fn(parsed.event);
          }
        } catch (error) {
          logger.error({ err: error }, 'Failed to parse admin pubsub payload');
        }
      };

      messageListeners.set(channel, listener);
      subscriber.on('message', listener);
    }

    handlers.add(handler);
    await subscriber.subscribe(channel);
  };

  const close = async (): Promise<void> => {
    for (const listener of messageListeners.values()) {
      subscriber.off('message', listener);
    }
    messageListeners.clear();
    chatChannelHandlers.clear();
    adminChannelHandlers.clear();
    await Promise.all([publisher.quit(), subscriber.quit()]);
  };

  return {
    publishChat,
    subscribeToChat,
    publishAdminState,
    subscribeToAdminState,
    close,
  };
};
