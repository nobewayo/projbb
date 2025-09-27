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

- packages/client/src/canvas/GridCanvas.tsx — exports: CanvasOccupant, CanvasItem, CanvasTypingIndicator, CanvasChatBubble
- packages/client/src/canvas/constants.ts — exports: TILE_WIDTH, TILE_HEIGHT, ROW_STEP, EVEN_ROW_COLUMNS, ODD_ROW_COLUMNS, GRID_HEIGHT, GRID_TOP_PADDING, GRID_BOTTOM_PADDING, GRID_SIDE_PADDING, GRID_LEFT_PADDING, GRID_RIGHT_PADDING, CANVAS_WIDTH, CANVAS_HEIGHT, ROW_COUNT
- packages/client/src/canvas/geometry.ts — exports: getColumnsForRow, buildGridDefinition, isPointInsideTile, findTileAtPoint, toScreenPosition
- packages/client/src/canvas/types.ts — exports: GridTile, GridRowMetadata, GridDefinition

## packages/client/src/components

- packages/client/src/components/InventoryCard.tsx — exports: InventoryEntry
- packages/client/src/components/ProfilePanel.tsx — exports: ProfilePanelState

## packages/client/src/hooks

- packages/client/src/hooks/useActionToast.ts — exports: ActionToast, UseActionToastResult, useActionToast

## packages/client/src/ws

- packages/client/src/ws/useRealtimeConnection.ts — exports: ConnectionStatus, RealtimeConnectionState, TradeLifecycleEvent, ActionResult, OccupantProfileSummary, TradeSessionBootstrap, TradeLifecycleAcknowledgement, MuteRecordSummary, ReportRecordSummary, useRealtimeConnection

## packages/schemas/src

- packages/schemas/src/index.ts

## packages/schemas/src/openapi

- packages/schemas/src/openapi/auth.ts — exports: authLoginOpenApiDocument

## packages/schemas/src/rest

- packages/schemas/src/rest/occupants.ts — exports: occupantProfileSchema, occupantProfileResponseSchema, tradeSessionSchema, tradeParticipantSchema, tradeProposalItemSchema, tradeProposalSchema, tradeNegotiationStateSchema, tradeBootstrapResponseSchema, tradeLifecycleResponseSchema, muteRecordSchema, muteResponseSchema, reportRecordSchema, reportResponseSchema, OccupantProfile, TradeSession, TradeBootstrapResponse, TradeLifecycleResponse, TradeProposal, TradeNegotiationState, MuteRecord, MuteResponse, ReportRecord, ReportResponse

## packages/schemas/src/ws

- packages/schemas/src/ws/admin.ts — exports: adminDevAffordanceSchema, adminLatencyTraceSchema, adminStateSchema, adminTileFlagUpdateDataSchema, adminAffordanceUpdateDataSchema, adminLatencyTraceEventDataSchema, AdminTileFlag, AdminDevAffordanceState, AdminLatencyTrace, AdminState, AdminTileFlagUpdateData, AdminAffordanceUpdateData, AdminLatencyTraceEventData
- packages/schemas/src/ws/auth.ts — exports: authRequestDataSchema, authRequestJsonSchema, AuthRequestData
- packages/schemas/src/ws/chat.ts — exports: chatSendRequestDataSchema, chatSendRequestEnvelopeSchema, chatTypingUpdateDataSchema, chatTypingUpdateEnvelopeSchema, chatMessageBroadcastSchema, chatMessageBroadcastEnvelopeSchema, chatTypingBroadcastSchema, chatTypingBroadcastEnvelopeSchema, chatPreferencesSchema, chatPreferenceUpdateDataSchema, chatPreferenceUpdateEnvelopeSchema, chatSendRequestJsonSchema, chatMessageBroadcastJsonSchema, ChatSendRequest, ChatMessageBroadcast, ChatTypingUpdate, ChatTypingBroadcast, ChatPreferences
- packages/schemas/src/ws/envelope.ts — exports: MessageEnvelope, messageEnvelopeSchema, buildEnvelopeSchema
- packages/schemas/src/ws/items.ts — exports: inventoryItemSchema, itemPickupRequestDataSchema, itemPickupOkDataSchema, itemPickupErrorCodeSchema, itemPickupErrorDataSchema, roomItemRemovedDataSchema, roomItemAddedDataSchema, InventoryItem, ItemPickupRequestData, ItemPickupOkData, ItemPickupErrorData, ItemPickupErrorCode, RoomItemRemovedData, RoomItemAddedData
- packages/schemas/src/ws/move.ts — exports: moveRequestDataSchema, moveRequestEnvelopeSchema, moveRequestJsonSchema, moveOkDataSchema, moveOkEnvelopeSchema, moveOkJsonSchema, moveErrorCodeSchema, moveErrorDataSchema, moveErrorEnvelopeSchema, moveErrorJsonSchema, MoveErrorCode
- packages/schemas/src/ws/room.ts — exports: roomTileFlagSchema, roomOccupantSchema, roomItemSchema, roomSnapshotSchema, roomOccupantMovedDataSchema, roomOccupantLeftDataSchema, RoomTileFlag, RoomOccupant, RoomSnapshot, RoomItem, RoomOccupantMovedData, RoomOccupantLeftData
- packages/schemas/src/ws/social.ts — exports: socialMuteRecordSchema, socialReportRecordSchema, socialStateSchema, socialMuteBroadcastSchema, socialReportBroadcastSchema, SocialMuteRecord, SocialReportRecord, SocialState, SocialMuteBroadcast, SocialReportBroadcast
- packages/schemas/src/ws/trade.ts — exports: tradeLifecycleBroadcastSchema, TradeLifecycleBroadcast

## packages/server

- packages/server/vitest.config.ts

## packages/server/src

- packages/server/src/config.ts — exports: ServerConfig, resolveCorsOrigins, loadConfig
- packages/server/src/index.ts
- packages/server/src/readiness.ts — exports: ReadinessController, createReadinessController
- packages/server/src/server.ts — exports: CreateServerOptions, createServer

## packages/server/src/__tests__/helpers

- packages/server/src/__tests__/helpers/testStack.ts — exports: TestStackConfig, TestStack, startTestStack

## packages/server/src/api

- packages/server/src/api/admin.ts — exports: adminRoutes
- packages/server/src/api/auth.ts — exports: authRoutes
- packages/server/src/api/occupants.ts — exports: occupantRoutes

## packages/server/src/auth

- packages/server/src/auth/http.ts — exports: extractBearerToken
- packages/server/src/auth/jwt.ts — exports: TokenClaims, signToken, decodeToken
- packages/server/src/auth/store.ts — exports: UserStore, createUserStore
- packages/server/src/auth/types.ts — exports: UserRecord, PublicUser, AuthenticatedUser, RoomSnapshotOccupant, RoomSnapshot

## packages/server/src/db

- packages/server/src/db/admin.ts — exports: DevAffordanceState, LatencyTraceState, RoomAdminStateRecord, AdminStateStore, createAdminStateStore
- packages/server/src/db/audit.ts — exports: AuditLogRecord, AuditLogStore, createAuditLogStore
- packages/server/src/db/chat.ts — exports: ChatMessageRecord, ChatStore, createChatStore
- packages/server/src/db/items.ts — exports: RoomItemRecord, InventoryItemRecord, ItemPickupFailureReason, ItemPickupResult, ItemStore, createItemStore
- packages/server/src/db/migrations.ts — exports: runMigrations
- packages/server/src/db/pool.ts — exports: createPgPool, DatabasePool
- packages/server/src/db/preferences.ts — exports: ChatPreferenceRecord, PreferenceStore, createPreferenceStore
- packages/server/src/db/rooms.ts — exports: RoomRecord, TileFlagRecord, RoomOccupantRecord, RoomStore, createRoomStore
- packages/server/src/db/social.ts — exports: TRADE_MAX_SLOTS_PER_USER, TradeSessionRecord, TradeProposalRecord, MuteRecord, ReportRecord, UserProfileRecord, SocialStore, createSocialStore

## packages/server/src/metrics

- packages/server/src/metrics/registry.ts — exports: MetricsBundle, createMetricsBundle

## packages/server/src/redis

- packages/server/src/redis/pubsub.ts — exports: RoomChatEvent, RoomAdminEvent, RoomItemEvent, RoomSocialEvent, RoomTradeEvent, RoomEvent, RoomPubSub, createRoomPubSub

## packages/server/src/ws

- packages/server/src/ws/connection.ts — exports: RealtimeServer, createRealtimeServer

