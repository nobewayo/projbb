# FEATURES

_Last updated: 2025-09-27T11:15:35.881Z_

This file is generated from the codebase (module tags, routes, exports) to inventory what exists today. Status and notes may need a quick human touch.

## Summary

| Module | Files | Server routes | WS events | Client components | Models |
|---|---:|---:|---:|---:|---:|
| __tests__ | 1 | 0 | 0 | 0 | 0 |
| auth | 1 | 0 | 0 | 0 | 0 |
| canvas | 4 | 0 | 0 | 0 | 0 |
| client | 3 | 0 | 0 | 0 | 0 |
| client-app | 1 | 0 | 0 | 0 | 0 |
| client-realtime | 1 | 0 | 0 | 0 | 0 |
| db | 9 | 0 | 0 | 0 | 0 |
| index.ts | 1 | 0 | 0 | 0 | 1 |
| main.tsx | 1 | 0 | 0 | 0 | 0 |
| metrics | 1 | 0 | 0 | 0 | 0 |
| openapi | 1 | 0 | 0 | 0 | 1 |
| redis | 1 | 0 | 3 | 0 | 0 |
| rest | 1 | 0 | 0 | 0 | 1 |
| server | 1 | 0 | 0 | 0 | 0 |
| server-admin-api | 1 | 5 | 0 | 0 | 1 |
| server-auth-api | 1 | 1 | 0 | 0 | 1 |
| server-auth-http | 1 | 0 | 0 | 0 | 0 |
| server-auth-jwt | 1 | 0 | 0 | 0 | 0 |
| server-auth-store | 1 | 0 | 0 | 0 | 0 |
| server-bootstrap | 1 | 0 | 0 | 0 | 0 |
| server-config | 1 | 0 | 0 | 0 | 1 |
| server-occupants-api | 1 | 10 | 0 | 0 | 1 |
| server-readiness | 1 | 0 | 0 | 0 | 0 |
| server-runtime | 1 | 3 | 1 | 0 | 0 |
| ui-feedback | 1 | 0 | 0 | 0 | 0 |
| ui-inventory | 1 | 0 | 0 | 0 | 0 |
| ui-profile | 1 | 0 | 0 | 0 | 0 |
| ws | 10 | 0 | 4 | 0 | 10 |

## __tests__

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/__tests__/helpers/testStack.ts — exports: TestStackConfig, TestStack, startTestStack

### Notes / TODO
- 

## auth

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/auth/types.ts — exports: UserRecord, PublicUser, AuthenticatedUser, RoomSnapshotOccupant, RoomSnapshot

### Notes / TODO
- 

## canvas

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/client/src/canvas/GridCanvas.tsx — exports: CanvasOccupant, CanvasItem, CanvasTypingIndicator, CanvasChatBubble
- packages/client/src/canvas/constants.ts — exports: TILE_WIDTH, TILE_HEIGHT, ROW_STEP, EVEN_ROW_COLUMNS, ODD_ROW_COLUMNS, GRID_HEIGHT, GRID_TOP_PADDING, GRID_BOTTOM_PADDING, GRID_SIDE_PADDING, GRID_LEFT_PADDING, GRID_RIGHT_PADDING, CANVAS_WIDTH, CANVAS_HEIGHT, ROW_COUNT
- packages/client/src/canvas/geometry.ts — exports: getColumnsForRow, buildGridDefinition, isPointInsideTile, findTileAtPoint, toScreenPosition
- packages/client/src/canvas/types.ts — exports: GridTile, GridRowMetadata, GridDefinition

### Notes / TODO
- 

## client

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## client-app

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## client-realtime

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/client/src/ws/useRealtimeConnection.ts — exports: ConnectionStatus, RealtimeConnectionState, TradeLifecycleEvent, ActionResult, OccupantProfileSummary, TradeSessionBootstrap, TradeLifecycleAcknowledgement, MuteRecordSummary, ReportRecordSummary, useRealtimeConnection

### Notes / TODO
- 

## db

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/db/admin.ts — exports: DevAffordanceState, LatencyTraceState, RoomAdminStateRecord, AdminStateStore, createAdminStateStore
- packages/server/src/db/audit.ts — exports: AuditLogRecord, AuditLogStore, createAuditLogStore
- packages/server/src/db/chat.ts — exports: ChatMessageRecord, ChatStore, createChatStore
- packages/server/src/db/items.ts — exports: RoomItemRecord, InventoryItemRecord, ItemPickupFailureReason, ItemPickupResult, ItemStore, createItemStore
- packages/server/src/db/migrations.ts — exports: runMigrations
- packages/server/src/db/pool.ts — exports: createPgPool, DatabasePool
- packages/server/src/db/preferences.ts — exports: ChatPreferenceRecord, PreferenceStore, createPreferenceStore
- packages/server/src/db/rooms.ts — exports: RoomRecord, TileFlagRecord, RoomOccupantRecord, RoomStore, createRoomStore
- packages/server/src/db/social.ts — exports: TRADE_MAX_SLOTS_PER_USER, TradeSessionRecord, TradeProposalRecord, MuteRecord, ReportRecord, UserProfileRecord, SocialStore, createSocialStore

### Notes / TODO
- 

## index.ts

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/schemas/src/index.ts

### Notes / TODO
- 

## main.tsx

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## metrics

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/metrics/registry.ts — exports: MetricsBundle, createMetricsBundle

### Notes / TODO
- 

## openapi

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/schemas/src/openapi/auth.ts

### Key exports (from codemap)
- packages/schemas/src/openapi/auth.ts — exports: authLoginOpenApiDocument

### Notes / TODO
- 

## redis

**Status:** _TBD_

**Overview:** _short description here_

### WebSocket events
- `on` `error` — packages/server/src/redis/pubsub.ts
- `on` `error` — packages/server/src/redis/pubsub.ts
- `on` `message` — packages/server/src/redis/pubsub.ts

### Key exports (from codemap)
- packages/server/src/redis/pubsub.ts — exports: RoomChatEvent, RoomAdminEvent, RoomItemEvent, RoomSocialEvent, RoomTradeEvent, RoomEvent, RoomPubSub, createRoomPubSub

### Notes / TODO
- 

## rest

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/schemas/src/rest/occupants.ts

### Key exports (from codemap)
- packages/schemas/src/rest/occupants.ts — exports: occupantProfileSchema, occupantProfileResponseSchema, tradeSessionSchema, tradeParticipantSchema, tradeProposalItemSchema, tradeProposalSchema, tradeNegotiationStateSchema, tradeBootstrapResponseSchema, tradeLifecycleResponseSchema, muteRecordSchema, muteResponseSchema, reportRecordSchema, reportResponseSchema, OccupantProfile, TradeSession, TradeBootstrapResponse, TradeLifecycleResponse, TradeProposal, TradeNegotiationState, MuteRecord, MuteResponse, ReportRecord, ReportResponse

### Notes / TODO
- 

## server

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## server-admin-api

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `POST` `/admin/rooms/:roomId/tiles/:x/:y/lock` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/tiles/:x/:y/no-pickup` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/dev-affordances` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/latency-trace` — packages/server/src/api/admin.ts
- `POST` `/admin/rooms/:roomId/items/plant` — packages/server/src/api/admin.ts

### Data models / schemas
- packages/server/src/api/admin.ts

### Key exports (from codemap)
- packages/server/src/api/admin.ts — exports: adminRoutes

### Notes / TODO
- 

## server-auth-api

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `POST` `/auth/login` — packages/server/src/api/auth.ts

### Data models / schemas
- packages/server/src/api/auth.ts

### Key exports (from codemap)
- packages/server/src/api/auth.ts — exports: authRoutes

### Notes / TODO
- 

## server-auth-http

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/auth/http.ts — exports: extractBearerToken

### Notes / TODO
- 

## server-auth-jwt

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/auth/jwt.ts — exports: TokenClaims, signToken, decodeToken

### Notes / TODO
- 

## server-auth-store

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/auth/store.ts — exports: UserStore, createUserStore

### Notes / TODO
- 

## server-bootstrap

**Status:** _TBD_

**Overview:** _short description here_

### Notes / TODO
- 

## server-config

**Status:** _TBD_

**Overview:** _short description here_

### Data models / schemas
- packages/server/src/config.ts

### Key exports (from codemap)
- packages/server/src/config.ts — exports: ServerConfig, resolveCorsOrigins, loadConfig

### Notes / TODO
- 

## server-occupants-api

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `GET` `/rooms/:roomId/occupants/:occupantId/profile` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/occupants/:occupantId/trade` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/accept` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/cancel` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/complete` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/proposals/:slotIndex` — packages/server/src/api/occupants.ts
- `DELETE` `/rooms/:roomId/trades/:tradeId/proposals/:slotIndex` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/trades/:tradeId/readiness` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/occupants/:occupantId/mute` — packages/server/src/api/occupants.ts
- `POST` `/rooms/:roomId/occupants/:occupantId/report` — packages/server/src/api/occupants.ts

### Data models / schemas
- packages/server/src/api/occupants.ts

### Key exports (from codemap)
- packages/server/src/api/occupants.ts — exports: occupantRoutes

### Notes / TODO
- 

## server-readiness

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/server/src/readiness.ts — exports: ReadinessController, createReadinessController

### Notes / TODO
- 

## server-runtime

**Status:** _TBD_

**Overview:** _short description here_

### Server routes
- `GET` `/healthz` — packages/server/src/server.ts
- `GET` `/readyz` — packages/server/src/server.ts
- `GET` `/metrics` — packages/server/src/server.ts

### WebSocket events
- `on` `connection` — packages/server/src/server.ts

### Key exports (from codemap)
- packages/server/src/server.ts — exports: CreateServerOptions, createServer

### Notes / TODO
- 

## ui-feedback

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/client/src/hooks/useActionToast.ts — exports: ActionToast, UseActionToastResult, useActionToast

### Notes / TODO
- 

## ui-inventory

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/client/src/components/InventoryCard.tsx — exports: InventoryEntry

### Notes / TODO
- 

## ui-profile

**Status:** _TBD_

**Overview:** _short description here_

### Key exports (from codemap)
- packages/client/src/components/ProfilePanel.tsx — exports: ProfilePanelState

### Notes / TODO
- 

## ws

**Status:** _TBD_

**Overview:** _short description here_

### WebSocket events
- `emit` `message` — packages/server/src/ws/connection.ts
- `on` `message` — packages/server/src/ws/connection.ts
- `on` `disconnect` — packages/server/src/ws/connection.ts
- `on` `error` — packages/server/src/ws/connection.ts

### Data models / schemas
- packages/server/src/ws/connection.ts
- packages/schemas/src/ws/admin.ts
- packages/schemas/src/ws/auth.ts
- packages/schemas/src/ws/chat.ts
- packages/schemas/src/ws/envelope.ts
- packages/schemas/src/ws/items.ts
- packages/schemas/src/ws/move.ts
- packages/schemas/src/ws/room.ts
- packages/schemas/src/ws/social.ts
- packages/schemas/src/ws/trade.ts

### Key exports (from codemap)
- packages/server/src/ws/connection.ts — exports: RealtimeServer, createRealtimeServer
- packages/schemas/src/ws/admin.ts — exports: adminDevAffordanceSchema, adminLatencyTraceSchema, adminStateSchema, adminTileFlagUpdateDataSchema, adminAffordanceUpdateDataSchema, adminLatencyTraceEventDataSchema, AdminTileFlag, AdminDevAffordanceState, AdminLatencyTrace, AdminState, AdminTileFlagUpdateData, AdminAffordanceUpdateData, AdminLatencyTraceEventData
- packages/schemas/src/ws/auth.ts — exports: authRequestDataSchema, authRequestJsonSchema, AuthRequestData
- packages/schemas/src/ws/chat.ts — exports: chatSendRequestDataSchema, chatSendRequestEnvelopeSchema, chatTypingUpdateDataSchema, chatTypingUpdateEnvelopeSchema, chatMessageBroadcastSchema, chatMessageBroadcastEnvelopeSchema, chatTypingBroadcastSchema, chatTypingBroadcastEnvelopeSchema, chatPreferencesSchema, chatPreferenceUpdateDataSchema, chatPreferenceUpdateEnvelopeSchema, chatSendRequestJsonSchema, chatMessageBroadcastJsonSchema, ChatSendRequest, ChatMessageBroadcast, ChatTypingUpdate, ChatTypingBroadcast, ChatPreferences
- packages/schemas/src/ws/envelope.ts — exports: MessageEnvelope, messageEnvelopeSchema, buildEnvelopeSchema
- packages/schemas/src/ws/items.ts — exports: inventoryItemSchema, itemPickupRequestDataSchema, itemPickupOkDataSchema, itemPickupErrorCodeSchema, itemPickupErrorDataSchema, roomItemRemovedDataSchema, roomItemAddedDataSchema, InventoryItem, ItemPickupRequestData, ItemPickupOkData, ItemPickupErrorData, ItemPickupErrorCode, RoomItemRemovedData, RoomItemAddedData
- packages/schemas/src/ws/move.ts — exports: moveRequestDataSchema, moveRequestEnvelopeSchema, moveRequestJsonSchema, moveOkDataSchema, moveOkEnvelopeSchema, moveOkJsonSchema, moveErrorCodeSchema, moveErrorDataSchema, moveErrorEnvelopeSchema, moveErrorJsonSchema, MoveErrorCode
- packages/schemas/src/ws/room.ts — exports: roomTileFlagSchema, roomOccupantSchema, roomItemSchema, roomSnapshotSchema, roomOccupantMovedDataSchema, roomOccupantLeftDataSchema, RoomTileFlag, RoomOccupant, RoomSnapshot, RoomItem, RoomOccupantMovedData, RoomOccupantLeftData
- packages/schemas/src/ws/social.ts — exports: socialMuteRecordSchema, socialReportRecordSchema, socialStateSchema, socialMuteBroadcastSchema, socialReportBroadcastSchema, SocialMuteRecord, SocialReportRecord, SocialState, SocialMuteBroadcast, SocialReportBroadcast
- packages/schemas/src/ws/trade.ts — exports: tradeLifecycleBroadcastSchema, TradeLifecycleBroadcast

### Notes / TODO
- 

