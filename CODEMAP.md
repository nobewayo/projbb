# CODEMAP

Generated at: 2025-09-27T00:27:13.004Z

## Module: Uncategorized

- **packages/client/src/canvas/types.ts**

- **packages/client/src/main.tsx**
  - Imports: ./App.js, react, react-dom/client

- **packages/client/vite.config.ts**
  - Exports: default
  - Imports: @vitejs/plugin-react, node:path, node:url, vite

- **packages/client/vitest.config.ts**
  - Exports: default
  - Imports: @vitejs/plugin-react, node:path, node:url, vitest/config

- **packages/client/vitest.setup.ts**
  - Imports: @testing-library/jest-dom/vitest

- **packages/server/src/__tests__/helpers/testStack.ts**
  - Exports: startTestStack
  - Imports: @testcontainers/postgresql, @testcontainers/redis, ioredis, pg
  - Functions:
    - parseInteger (line 9)
      - const parseInteger = (value: string | undefined, fallback: number): number =>
    - buildRedisFlusher (line 37)
      - const buildRedisFlusher = (redisUrl: string) =>
    - attemptExternalStack (line 46)
      - async const attemptExternalStack = (): Promise<TestStack | null> =>
    - startContainerStack (line 108)
      - async const startContainerStack = (): Promise<TestStack> =>
    - startTestStack (line 138) [exported]
      - async const startTestStack = (): Promise<TestStack> =>

- **packages/server/src/auth/http.ts**
  - Exports: extractBearerToken
  - Functions:
    - extractBearerToken (line 1) [exported]
      - const extractBearerToken = (authorization?: string): string | null =>

- **packages/server/src/auth/jwt.ts**
  - Exports: decodeToken, signToken
  - Imports: ../config.js, ./types.js, jsonwebtoken
  - Functions:
    - assertValidClaims (line 11)
      - function assertValidClaims(claims: TokenClaims): asserts claims is TokenClaims & { sub: string; username: string }
    - signToken (line 23) [exported]
      - const signToken = (user: PublicUser, config: ServerConfig): string =>
    - decodeToken (line 37) [exported]
      - const decodeToken = (token: string, config: ServerConfig): AuthenticatedUser =>

- **packages/server/src/auth/store.ts**
  - Exports: createUserStore
  - Imports: ./types.js, argon2, pg
  - Functions:
    - normaliseUsername (line 11)
      - const normaliseUsername = (username: string): string =>
    - createUserStore (line 13) [exported]
      - const createUserStore = (pool: Pool): UserStore =>
    - findUserByUsername (line 14)
      - async const findUserByUsername = (username: string): Promise<UserRecord | null> =>
    - toPublicUser (line 41)
      - const toPublicUser = (user: UserRecord): PublicUser =>
    - verifyUserPassword (line 47)
      - async const verifyUserPassword = (user: UserRecord, password: string): Promise<boolean> =>

- **packages/server/src/auth/types.ts**

- **packages/server/src/config.ts**
  - Exports: loadConfig, resolveCorsOrigins
  - Imports: zod
  - Functions:
    - numericEnv (line 3)
      - const numericEnv = (value: unknown, defaultValue: number): number =>
    - buildOrigin (line 60)
      - const buildOrigin = (protocol: string, hostname: string, port: string): string =>
    - resolveCorsOrigins (line 67) [exported]
      - const resolveCorsOrigins = (origin: string): string | string[] =>
    - addVariant (line 80)
      - const addVariant = (value: string): void =>
    - loadConfig (line 94) [exported]
      - const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig =>

- **packages/server/src/db/admin.ts**
  - Exports: createAdminStateStore
  - Imports: pg
  - Functions:
    - mapRow (line 39)
      - const mapRow = (row: {
  room_id: string;
  grid_visible: boolean | null;
  show_hover_when_grid_hidden: boolean | null;
  move_animations_enabled: boolean | null;
  last_latency_trace_id: string | null;
  last_latency_trace_requested_at: Date | string | null;
  last_latency_trace_requested_by: string | null;
}): RoomAdminStateRecord =>
    - serialiseTrace (line 76)
      - const serialiseTrace = (trace: LatencyTraceState | null): {
  id: string | null;
  requestedAt: Date | null;
  requestedBy: string | null;
} =>
    - createAdminStateStore (line 91) [exported]
      - const createAdminStateStore = (pool: Pool): AdminStateStore =>
    - getRoomState (line 92)
      - async const getRoomState = (roomId: string): Promise<RoomAdminStateRecord> =>
    - upsertState (line 109)
      - async const upsertState = (roomId: string, next: RoomAdminStateRecord): Promise<RoomAdminStateRecord> =>
    - updateAffordances (line 148)
      - async const updateAffordances = (roomId: string, updates: Partial<DevAffordanceState>): Promise<RoomAdminStateRecord> =>
    - recordLatencyTrace (line 164)
      - async const recordLatencyTrace = (roomId: string, trace: { traceId: string; requestedAt: Date; requestedBy: string | null }): Promise<RoomAdminStateRecord> =>

- **packages/server/src/db/audit.ts**
  - Exports: createAuditLogStore
  - Imports: pg
  - Functions:
    - parseContext (line 25)
      - const parseContext = (raw: unknown): Record<string, unknown> =>
    - mapRow (line 33)
      - const mapRow = (row: {
  id: number;
  user_id: string;
  room_id: string | null;
  action: string;
  ctx: unknown;
  created_at: Date | string;
}): AuditLogRecord =>
    - createAuditLogStore (line 50) [exported]
      - const createAuditLogStore = (pool: Pool): AuditLogStore =>
    - recordAdminAction (line 51)
      - async const recordAdminAction = ({
    userId,
    roomId,
    action,
    context,
  }) =>
    - listRecentAdminActions (line 67)
      - async const listRecentAdminActions = (options = {}) =>

- **packages/server/src/db/chat.ts**
  - Exports: createChatStore
  - Imports: pg
  - Functions:
    - mapRow (line 28)
      - const mapRow = (row: {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  roles: string[] | null;
  body: string;
  created_at: Date;
  room_seq: string | number;
}): ChatMessageRecord =>
    - createChatStore (line 48) [exported]
      - const createChatStore = (pool: Pool): ChatStore =>
    - createMessage (line 49)
      - async const createMessage = ({
    id,
    roomId,
    userId,
    body,
    roomSeq,
  }: {
    id: string;
    roomId: string;
    userId: string;
    body: string;
    roomSeq: number;
  }): Promise<ChatMessageRecord> =>
    - listRecentMessages (line 83)
      - async const listRecentMessages = (roomId: string, limit: number): Promise<ChatMessageRecord[]> =>
    - pruneMessagesForRoom (line 109)
      - async const pruneMessagesForRoom = ({
    roomId,
    retain,
  }) =>

- **packages/server/src/db/items.ts**
  - Exports: createItemStore
  - Imports: node:crypto, pg
  - Functions:
    - mapRoomItemRow (line 53)
      - const mapRoomItemRow = (row: {
  id: string;
  room_id: string;
  name: string;
  description: string;
  texture_key: string;
  tile_x: number;
  tile_y: number;
  picked_up_at: Date | string | null;
  picked_up_by: string | null;
}): RoomItemRecord =>
    - mapInventoryRow (line 75)
      - const mapInventoryRow = (row: {
  id: string;
  user_id: string;
  room_item_id: string;
  room_id: string;
  acquired_at: Date | string;
}): {
  id: string;
  userId: string;
  roomItemId: string;
  roomId: string;
  acquiredAt: Date;
} =>
    - withTransaction (line 95)
      - async const withTransaction = (pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> =>
    - createItemStore (line 115) [exported]
      - const createItemStore = (pool: Pool): ItemStore =>
    - listRoomItems (line 116)
      - async const listRoomItems = (roomId: string): Promise<RoomItemRecord[]> =>
    - listInventoryForUser (line 138)
      - async const listInventoryForUser = (userId: string): Promise<InventoryItemRecord[]> =>
    - attemptPickup (line 166)
      - async const attemptPickup = ({
    itemId,
    userId,
    roomId,
  }: {
    itemId: string;
    userId: string;
    roomId: string;
  }): Promise<ItemPickupResult> =>
    - createRoomItem (line 263)
      - async const createRoomItem = ({
    roomId,
    name,
    description,
    textureKey,
    tileX,
    tileY,
    id,
  }: {
    roomId: string;
    name: string;
    description: string;
    textureKey: string;
    tileX: number;
    tileY: number;
    id?: string;
  }): Promise<RoomItemRecord> =>

- **packages/server/src/db/migrations.ts**
  - Exports: runMigrations
  - Imports: ./social.js, pg
  - Functions:
    - escapeSqlString (line 68)
      - const escapeSqlString = (value: string): string =>
    - ensureMigrationTable (line 308)
      - async const ensureMigrationTable = (pool: Pool): Promise<void> =>
    - hasMigrationRun (line 317)
      - async const hasMigrationRun = (client: PoolClient, id: string): Promise<boolean> =>
    - recordMigration (line 325)
      - async const recordMigration = (client: PoolClient, id: string): Promise<void> =>
    - runMigrations (line 332) [exported]
      - async const runMigrations = (pool: Pool): Promise<void> =>

- **packages/server/src/db/pool.ts**
  - Exports: createPgPool
  - Imports: ../config.js, pg
  - Functions:
    - createPgPool (line 4) [exported]
      - const createPgPool = (config: ServerConfig): Pool =>

- **packages/server/src/db/preferences.ts**
  - Exports: createPreferenceStore
  - Imports: pg
  - Functions:
    - createPreferenceStore (line 16) [exported]
      - const createPreferenceStore = (pool: Pool): PreferenceStore =>
    - getChatPreferences (line 17)
      - async const getChatPreferences = (userId: string): Promise<ChatPreferenceRecord> =>
    - updateChatShowSystemMessages (line 31)
      - async const updateChatShowSystemMessages = (userId: string, showSystemMessages: boolean): Promise<ChatPreferenceRecord> =>

- **packages/server/src/db/rooms.ts**
  - Exports: createRoomStore
  - Imports: ../auth/types.js, pg
  - Functions:
    - mapRoomRow (line 42)
      - const mapRoomRow = (row: {
  id: string;
  slug: string;
  name: string;
  room_seq: string | number;
}): RoomRecord =>
    - mapOccupantRow (line 54)
      - const mapOccupantRow = (row: {
  id: string;
  username: string;
  roles: string[] | null;
  x: number;
  y: number;
  room_id?: string | null;
}): RoomSnapshotOccupant & { roomId: string | null } =>
    - createRoomStore (line 69) [exported]
      - const createRoomStore = (pool: Pool): RoomStore =>
    - getRoomBySlug (line 70)
      - async const getRoomBySlug = (slug: string): Promise<RoomRecord | null> =>
    - getRoomById (line 83)
      - async const getRoomById = (id: string): Promise<RoomRecord | null> =>
    - getTileFlags (line 96)
      - async const getTileFlags = (roomId: string): Promise<TileFlagRecord[]> =>
    - getTileFlag (line 110)
      - async const getTileFlag = (roomId: string, x: number, y: number): Promise<TileFlagRecord | null> =>
    - updateTileFlag (line 131)
      - async const updateTileFlag = (roomId: string, x: number, y: number, updates: Partial<Omit<TileFlagRecord, 'x' | 'y'>>): Promise<TileFlagRecord> =>
    - listOccupants (line 157)
      - async const listOccupants = (roomId: string): Promise<RoomSnapshotOccupant[]> =>
    - getOccupant (line 180)
      - async const getOccupant = (userId: string): Promise<RoomOccupantRecord | null> =>
    - upsertOccupantPosition (line 204)
      - async const upsertOccupantPosition = (userId: string, roomId: string, position: { x: number; y: number }): Promise<RoomSnapshotOccupant> =>
    - clearOccupant (line 227)
      - async const clearOccupant = (userId: string): Promise<void> =>
    - incrementRoomSequence (line 231)
      - async const incrementRoomSequence = (roomId: string): Promise<number> =>

  - _Output truncated due to markdownMaxPerGroup limit._

## Module: canvas

- **packages/client/src/canvas/constants.ts**
  - Tags: grid, constants

- **packages/client/src/canvas/geometry.ts**
  - Tags: grid, geometry
  - Exports: buildGridDefinition, createTileKey, findTileAtPoint, getColumnsForRow, isPointInsideTile, toScreenPosition
  - Imports: ./constants, ./types
  - Functions:
    - createTileKey (line 20)
      - const createTileKey = (gridX: number, gridY: number): string =>
    - getColumnsForRow (line 22) [exported]
      - const getColumnsForRow = (row: number): number =>
    - getMaxColumns (line 25)
      - const getMaxColumns = (): number =>
    - getRowOffset (line 27)
      - const getRowOffset = (row: number): number =>
    - getRowRightSpan (line 32)
      - const getRowRightSpan = (row: number): number =>
    - computeMaxRowSpan (line 38)
      - const computeMaxRowSpan = (rowCount: number): number =>
    - buildGridDefinition (line 51) [exported]
      - const buildGridDefinition = (canvasWidth: number = CANVAS_WIDTH, canvasHeight: number = CANVAS_HEIGHT): GridDefinition =>
    - isPointInsideTile (line 116) [exported]
      - const isPointInsideTile = (tile: GridTile, px: number, py: number): boolean =>
    - findTileAtPoint (line 123) [exported]
      - const findTileAtPoint = (grid: GridDefinition, px: number, py: number): GridTile | null =>
    - toScreenPosition (line 170) [exported]
      - const toScreenPosition = (grid: GridDefinition, gridX: number, gridY: number): { x: number; y: number } =>

- **packages/client/src/canvas/GridCanvas.tsx**
  - Tags: grid, rendering, input
  - Exports: default
  - Imports: ../assets/avatars/avatar1.png, ../assets/avatars/avatar2.png, ../assets/rooms/dev_room.png, ./constants, ./geometry, ./types, react
  - Functions:
    - loadImage (line 168)
      - async const loadImage = (source: string): Promise<HTMLImageElement> =>
    - easeOutCubic (line 176)
      - const easeOutCubic = (t: number): number =>
    - prepareContext (line 178)
      - const prepareContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null =>
    - drawBackground (line 201)
      - const drawBackground = (context: CanvasRenderingContext2D, assets: SpriteAssets | null): void =>
    - traceDiamond (line 212)
      - const traceDiamond = (context: CanvasRenderingContext2D, tile: GridTile): void =>
    - drawTile (line 221)
      - const drawTile = (context: CanvasRenderingContext2D, tile: GridTile, options: { hovered: boolean; locked: boolean; pending: boolean; noPickup: boolean }): void =>
    - drawHiddenHoverTile (line 260)
      - const drawHiddenHoverTile = (context: CanvasRenderingContext2D, tile: GridTile): void =>
    - drawUsername (line 275)
      - const drawUsername = (context: CanvasRenderingContext2D, sprite: OccupantRenderState): void =>
    - splitLongWord (line 290)
      - const splitLongWord = (context: CanvasRenderingContext2D, word: string, maxWidth: number): string[] =>
    - wrapBubbleLines (line 314)
      - const wrapBubbleLines = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] =>
    - pushLine (line 331)
      - const pushLine = (line: string) =>
    - drawSpeechBubble (line 377)
      - const drawSpeechBubble = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, options: {
    text: string;
    fill: string;
    textColor: string;
    offset: number;
  }): void =>
    - drawTypingBubble (line 453)
      - const drawTypingBubble = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, indicator: CanvasTypingIndicator): void =>
    - drawChatBubbleForSprite (line 467)
      - const drawChatBubbleForSprite = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, bubble: CanvasChatBubble): void =>
    - drawOccupant (line 480)
      - const drawOccupant = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, assets: SpriteAssets | null): void =>
    - updateSpritePositions (line 511)
      - const updateSpritePositions = (sprites: Map<string, OccupantRenderState>, now: number, animationsEnabled: boolean): void =>
    - getAvatarVariantIndex (line 539)
      - const getAvatarVariantIndex = (occupant: CanvasOccupant): number =>
    - formatCoordinate (line 556)
      - const formatCoordinate = (value: number): string =>
    - GridCanvas (line 558)
      - const GridCanvas = ({
  occupants,
  tileFlags,
  pendingMoveTarget,
  onTileClick,
  items,
  onTileContextMenu,
  onItemContextMenu,
  onOccupantContextMenu,
  localOccupantId = null,
  showGrid,
  showHoverWhenGridHidden,
  moveAnimationsEnabled,
  typingIndicators,
  chatBubbles,
}: GridCanvasProps): JSX.Element =>
    - loadAssets (line 631)
      - async const loadAssets = (): Promise<void> =>
    - loadItemAssets (line 669)
      - async const loadItemAssets = (): Promise<void> =>
    - renderFrame (line 858)
      - const renderFrame = (timestamp: number): void =>
    - handlePointerMove (line 1018)
      - const handlePointerMove = (event: PointerEvent): void =>
    - handlePointerLeave (line 1037)
      - const handlePointerLeave = (): void =>
    - handlePointerDown (line 1043)
      - const handlePointerDown = (event: PointerEvent): void =>
    - handleContextMenu (line 1060)
      - const handleContextMenu = (event: MouseEvent): void =>
    - getTileItems (line 1069)
      - const getTileItems = (tile: GridTile | null): CanvasItem[] =>


## Module: client-app

- **packages/client/src/App.tsx**
  - Tags: ui, realtime, smoke-check
  - Exports: default
  - Imports: ./assets/items/couch.png, ./assets/items/plant.png, ./canvas/GridCanvas, ./canvas/geometry, ./canvas/types, ./components/InventoryCard, ./components/ProfilePanel, ./hooks/useActionToast, ./styles.css, ./ws/useRealtimeConnection, react
  - Functions:
    - adjustPosition (line 167)
      - const adjustPosition = (): void =>
    - renderTileSection (line 251)
      - const renderTileSection = (tile: GridTile, items: CanvasItem[], focusedItemId: string | null): JSX.Element =>
    - renderTileMenu (line 314)
      - const renderTileMenu = (payload: TileContextMenuState): JSX.Element =>
    - renderOccupantMenu (line 317)
      - const renderOccupantMenu = (payload: OccupantContextMenuState): JSX.Element =>
    - App (line 488)
      - const App = (): JSX.Element =>
    - isEditableElement (line 735)
      - const isEditableElement = (element: Element | null): boolean =>
    - commitDraft (line 748)
      - const commitDraft = (next: string) =>
    - handleGlobalKeyDown (line 758)
      - const handleGlobalKeyDown = (event: KeyboardEvent): void =>
    - buildSlots (line 972)
      - const buildSlots = (userId: string | null) =>
    - handleSlotChange (line 989)
      - const handleSlotChange = (slotIndex: number, value: string) =>
    - handleSlotClear (line 1013)
      - const handleSlotClear = (slotIndex: number) =>
    - handleReadinessToggle (line 1036)
      - const handleReadinessToggle = (next: boolean) =>
    - parseTimestamp (line 1236)
      - const parseTimestamp = (value?: string | null): number =>
    - handlePointerDown (line 1387)
      - const handlePointerDown = (event: PointerEvent): void =>
    - handleKeyDown (line 1406)
      - const handleKeyDown = (event: KeyboardEvent): void =>
    - handleScroll (line 1429)
      - const handleScroll = (): void =>
    - handleMenuButtonClick (line 2044)
      - const handleMenuButtonClick = (label: string): void =>


## Module: client-realtime

- **packages/client/src/ws/useRealtimeConnection.ts**
  - Tags: websocket, state, hooks
  - Exports: useRealtimeConnection
  - Imports: @bitby/schemas, react, socket.io-client
  - Functions:
    - sortRoomItems (line 73)
      - const sortRoomItems = (items: Iterable<RoomItem>): RoomItem[] =>
    - sortInventoryItems (line 81)
      - const sortInventoryItems = (items: Iterable<InventoryItem>): InventoryItem[] =>
    - isSessionUser (line 111)
      - const isSessionUser = (value: unknown): value is SessionUser =>
    - isSessionRoom (line 126)
      - const isSessionRoom = (value: unknown): value is SessionRoom =>
    - cloneOccupant (line 253)
      - const cloneOccupant = (occupant: RoomOccupant): RoomOccupant =>
    - sortOccupants (line 259)
      - const sortOccupants = (map: Map<string, RoomOccupant>): RoomOccupant[] =>
    - buildEnvelope (line 270)
      - const buildEnvelope = (seq: number, op: string, data: Record<string, unknown> = {}): MessageEnvelope =>
    - normaliseSocketProtocol (line 286)
      - const normaliseSocketProtocol = (protocol: string): string =>
    - resolveSocketEndpoint (line 297)
      - const resolveSocketEndpoint = (): SocketEndpoint =>
    - resolveHttpBaseUrl (line 323)
      - const resolveHttpBaseUrl = (): string =>
    - getExplicitToken (line 338)
      - const getExplicitToken = (): string | null =>
    - getDevCredentials (line 343)
      - const getDevCredentials = (): { username: string; password: string } =>
    - getLatestPendingTarget (line 348)
      - const getLatestPendingTarget = (pendingMoves: Map<number, { to: { x: number; y: number } }>): { x: number; y: number } | null =>
    - normaliseTypingPreview (line 358)
      - const normaliseTypingPreview = (input: string | null | undefined): string | null =>
    - snapshotTypingIndicators (line 369)
      - const snapshotTypingIndicators = (source: Map<string, TypingIndicatorInternal>): TypingIndicatorView[] =>
    - snapshotChatBubbles (line 378)
      - const snapshotChatBubbles = (source: Map<string, ChatBubbleInternal>): ChatBubbleView[] =>
    - useRealtimeConnection (line 388) [exported]
      - const useRealtimeConnection = (): RealtimeConnectionState =>
    - clearPingTimer (line 448)
      - const clearPingTimer = () =>
    - clearCountdownTimer (line 455)
      - const clearCountdownTimer = () =>
    - clearTypingCleanupTimer (line 462)
      - const clearTypingCleanupTimer = () =>
    - clearBubbleCleanupTimer (line 469)
      - const clearBubbleCleanupTimer = () =>
    - abortLogin (line 476)
      - const abortLogin = () =>
    - clearActiveSocket (line 484)
      - const clearActiveSocket = () =>
    - startPingTimer (line 507)
      - const startPingTimer = (intervalMs: number) =>
    - updateState (line 523)
      - const updateState = (partial: Partial<InternalConnectionState>) =>
    - requestAuthToken (line 546)
      - async const requestAuthToken = (): Promise<string> =>
    - scheduleReconnect (line 641)
      - const scheduleReconnect = () =>
    - filterChatLogByMuted (line 701)
      - const filterChatLogByMuted = (log: ChatMessageBroadcast[], mutedIds: Set<string>): ChatMessageBroadcast[] =>
    - appendChatMessage (line 709)
      - const appendChatMessage = (message: ChatMessageBroadcast) =>
    - publishTypingIndicators (line 728)
      - const publishTypingIndicators = () =>
    - pruneTypingIndicators (line 732)
      - const pruneTypingIndicators = (now: number = Date.now()): void =>
    - scheduleTypingCleanup (line 745)
      - const scheduleTypingCleanup = () =>
    - upsertTypingIndicator (line 756)
      - const upsertTypingIndicator = (userId: string, preview: string | null, expiresAt?: number): void =>
    - removeTypingIndicator (line 773)
      - const removeTypingIndicator = (userId: string): void =>
    - publishChatBubbles (line 782)
      - const publishChatBubbles = () =>
    - pruneChatBubbles (line 786)
      - const pruneChatBubbles = (now: number = Date.now()): void =>
    - scheduleBubbleCleanup (line 799)
      - const scheduleBubbleCleanup = () =>
    - upsertChatBubble (line 810)
      - const upsertChatBubble = (userId: string, messageId: string, body: string): void =>
    - removeChatBubble (line 820)
      - const removeChatBubble = (userId: string): void =>
    - handleEnvelope (line 829)
      - const handleEnvelope = (envelope: MessageEnvelope) =>
    - connect (line 1479)
      - async const connect = () =>
    - detachListeners (line 1536)
      - const detachListeners = () =>


## Module: server-admin-api

- **packages/server/src/api/admin.ts**
  - Tags: fastify, admin, http
  - Exports: adminRoutes
  - Imports: ../auth/http.js, ../auth/jwt.js, ../auth/types.js, ../config.js, ../db/admin.js, ../db/audit.js, ../db/items.js, ../db/rooms.js, ../ws/connection.js, fastify, node:crypto, zod
  - Functions:
    - isTileInBounds (line 72)
      - const isTileInBounds = (x: number, y: number): boolean =>
    - adminRoutes (line 81) [exported]
      - const adminRoutes = (app, options, done) =>
    - requireAdmin (line 90)
      - async const requireAdmin = (request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedUser | null> =>


## Module: server-auth-api

- **packages/server/src/api/auth.ts**
  - Tags: fastify, auth, http
  - Exports: authRoutes
  - Imports: ../auth/jwt.js, ../auth/store.js, ../config.js, fastify, zod
  - Functions:
    - authRoutes (line 20) [exported]
      - async const authRoutes = (app: FastifyInstance, options: AuthPluginOptions): Promise<void> =>


## Module: server-occupants-api

- **packages/server/src/api/occupants.ts**
  - Tags: fastify, rooms, http
  - Exports: occupantRoutes
  - Imports: ../auth/http.js, ../auth/jwt.js, ../config.js, ../db/items.js, ../db/rooms.js, ../db/social.js, ../ws/connection.js, fastify, zod
  - Functions:
    - occupantRoutes (line 65) [exported]
      - const occupantRoutes = (app, options, done) =>
    - requireAuth (line 72)
      - const requireAuth = (request: FastifyRequest): { userId: string } | null =>
    - resolveOccupantContext (line 87)
      - async const resolveOccupantContext = (roomId: string, occupantId: string, requesterId: string) =>
    - resolveTradeContext (line 110)
      - async const resolveTradeContext = (roomId: string, tradeId: string, requesterId: string) =>
    - mapTradeRecord (line 137)
      - const mapTradeRecord = (trade: TradeSessionRecord) =>
    - mapTradeProposal (line 153)
      - const mapTradeProposal = (proposal: TradeProposalRecord) =>
    - buildNegotiationState (line 166)
      - async const buildNegotiationState = (tradeId: string) =>
    - resolveTradeParticipant (line 174)
      - async const resolveTradeParticipant = (params: {
    trade: TradeSessionRecord;
    requesterId: string;
  }) =>


## Module: shared-rest-auth

- **packages/schemas/src/openapi/auth.ts**
  - Tags: openapi, auth, http
  - Imports: openapi-types


## Module: shared-rest-occupants

- **packages/schemas/src/rest/occupants.ts**
  - Tags: rest, occupants, zod
  - Imports: zod


## Module: shared-schemas-root

- **packages/schemas/src/index.ts**
  - Tags: schemas, exports
  - Exports: *


## Module: shared-ws-admin

- **packages/schemas/src/ws/admin.ts**
  - Tags: websocket, admin, schema
  - Imports: zod


## Module: shared-ws-auth

- **packages/schemas/src/ws/auth.ts**
  - Tags: websocket, auth, schema
  - Imports: zod


## Module: shared-ws-chat

- **packages/schemas/src/ws/chat.ts**
  - Tags: websocket, chat, schema
  - Imports: ./envelope.js, zod


## Module: shared-ws-envelope

- **packages/schemas/src/ws/envelope.ts**
  - Tags: websocket, schema, helpers
  - Exports: buildEnvelopeSchema
  - Imports: zod
  - Functions:
    - buildEnvelopeSchema (line 19) [exported]
      - const buildEnvelopeSchema = (dataSchema: Schema) =>


## Module: shared-ws-items

- **packages/schemas/src/ws/items.ts**
  - Tags: websocket, items, schema
  - Exports: roomItemSchema
  - Imports: ./room.js, zod


## Module: shared-ws-move

- **packages/schemas/src/ws/move.ts**
  - Tags: websocket, movement, schema
  - Imports: ./envelope.js, zod


## Module: shared-ws-room

- **packages/schemas/src/ws/room.ts**
  - Tags: websocket, room, schema
  - Imports: ./admin.js, zod


## Module: shared-ws-social

- **packages/schemas/src/ws/social.ts**
  - Tags: websocket, social, schema
  - Imports: zod


## Module: shared-ws-trade

- **packages/schemas/src/ws/trade.ts**
  - Tags: websocket, trade, schema
  - Imports: ../rest/occupants.js, zod


## Module: ui-feedback

- **packages/client/src/hooks/useActionToast.ts**
  - Tags: toast, hooks, ui
  - Exports: useActionToast
  - Imports: react
  - Functions:
    - useActionToast (line 18) [exported]
      - const useActionToast = (timeoutMs = 4000): UseActionToastResult =>


## Module: ui-inventory

- **packages/client/src/components/InventoryCard.tsx**
  - Tags: inventory, panel, ui
  - Exports: default
  - Functions:
    - InventoryCard (line 16)
      - const InventoryCard = ({ items }: InventoryCardProps): JSX.Element =>


## Module: ui-profile

- **packages/client/src/components/ProfilePanel.tsx**
  - Tags: profile, panel, realtime
  - Exports: default
  - Imports: ../ws/useRealtimeConnection
  - Functions:
    - ProfilePanel (line 18)
      - const ProfilePanel = ({ state, onRetry, onClose }: ProfilePanelProps): JSX.Element | null =>

