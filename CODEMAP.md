# CODEMAP

Total files: 50

## packages/client

- packages/client/vite.config.ts
- packages/client/vitest.config.ts
- packages/client/vitest.setup.ts

## packages/client/src

- packages/client/src/App.tsx
- packages/client/src/main.tsx

## packages/client/src/canvas

- packages/client/src/canvas/GridCanvas.tsx
- packages/client/src/canvas/constants.ts
- packages/client/src/canvas/geometry.ts — exports: createTileKey, getColumnsForRow, buildGridDefinition, isPointInsideTile, findTileAtPoint, toScreenPosition
- packages/client/src/canvas/types.ts

## packages/client/src/components

- packages/client/src/components/InventoryCard.tsx
- packages/client/src/components/ProfilePanel.tsx

## packages/client/src/hooks

- packages/client/src/hooks/useActionToast.ts — exports: useActionToast

## packages/client/src/ws

- packages/client/src/ws/useRealtimeConnection.ts — exports: useRealtimeConnection

## packages/schemas/src

- packages/schemas/src/index.ts

## packages/schemas/src/openapi

- packages/schemas/src/openapi/auth.ts

## packages/schemas/src/rest

- packages/schemas/src/rest/occupants.ts

## packages/schemas/src/ws

- packages/schemas/src/ws/admin.ts
- packages/schemas/src/ws/auth.ts
- packages/schemas/src/ws/chat.ts
- packages/schemas/src/ws/envelope.ts — exports: buildEnvelopeSchema
- packages/schemas/src/ws/items.ts — exports: roomItemSchema
- packages/schemas/src/ws/move.ts
- packages/schemas/src/ws/room.ts
- packages/schemas/src/ws/social.ts
- packages/schemas/src/ws/trade.ts

## packages/server

- packages/server/vitest.config.ts

## packages/server/src

- packages/server/src/config.ts — exports: resolveCorsOrigins, loadConfig
- packages/server/src/index.ts
- packages/server/src/readiness.ts — exports: createReadinessController
- packages/server/src/server.ts — exports: createServer

## packages/server/src/__tests__/helpers

- packages/server/src/__tests__/helpers/testStack.ts — exports: startTestStack

## packages/server/src/api

- packages/server/src/api/admin.ts — exports: adminRoutes
- packages/server/src/api/auth.ts — exports: authRoutes
- packages/server/src/api/occupants.ts — exports: occupantRoutes

## packages/server/src/auth

- packages/server/src/auth/http.ts — exports: extractBearerToken
- packages/server/src/auth/jwt.ts — exports: signToken, decodeToken
- packages/server/src/auth/store.ts — exports: createUserStore
- packages/server/src/auth/types.ts

## packages/server/src/db

- packages/server/src/db/admin.ts — exports: createAdminStateStore
- packages/server/src/db/audit.ts — exports: createAuditLogStore
- packages/server/src/db/chat.ts — exports: createChatStore
- packages/server/src/db/items.ts — exports: createItemStore
- packages/server/src/db/migrations.ts — exports: runMigrations
- packages/server/src/db/pool.ts — exports: createPgPool
- packages/server/src/db/preferences.ts — exports: createPreferenceStore
- packages/server/src/db/rooms.ts — exports: createRoomStore
- packages/server/src/db/social.ts — exports: createSocialStore

## packages/server/src/metrics

- packages/server/src/metrics/registry.ts — exports: createMetricsBundle

## packages/server/src/redis

- packages/server/src/redis/pubsub.ts — exports: createRoomPubSub

## packages/server/src/ws

- packages/server/src/ws/connection.ts — exports: createRealtimeServer

