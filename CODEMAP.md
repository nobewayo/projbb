# CODEMAP

Generated at: 2025-09-26T22:12:55.847Z

## Module: Uncategorized

- **packages/client/src/canvas/GridCanvas.tsx**
  - Exports: default
  - Imports: ../assets/avatars/avatar1.png, ../assets/avatars/avatar2.png, ../assets/rooms/dev_room.png, ./constants, ./geometry, ./types, react
  - Functions:
    - loadImage (line 165)
      - async const loadImage = (source: string): Promise<HTMLImageElement> =>
    - easeOutCubic (line 173)
      - const easeOutCubic = (t: number): number =>
    - prepareContext (line 175)
      - const prepareContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null =>
    - drawBackground (line 198)
      - const drawBackground = (context: CanvasRenderingContext2D, assets: SpriteAssets | null): void =>
    - traceDiamond (line 209)
      - const traceDiamond = (context: CanvasRenderingContext2D, tile: GridTile): void =>
    - drawTile (line 218)
      - const drawTile = (context: CanvasRenderingContext2D, tile: GridTile, options: { hovered: boolean; locked: boolean; pending: boolean; noPickup: boolean }): void =>
    - drawHiddenHoverTile (line 257)
      - const drawHiddenHoverTile = (context: CanvasRenderingContext2D, tile: GridTile): void =>
    - drawUsername (line 272)
      - const drawUsername = (context: CanvasRenderingContext2D, sprite: OccupantRenderState): void =>
    - splitLongWord (line 287)
      - const splitLongWord = (context: CanvasRenderingContext2D, word: string, maxWidth: number): string[] =>
    - wrapBubbleLines (line 311)
      - const wrapBubbleLines = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] =>
    - pushLine (line 328)
      - const pushLine = (line: string) =>
    - drawSpeechBubble (line 374)
      - const drawSpeechBubble = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, options: {
    text: string;
    fill: string;
    textColor: string;
    offset: number;
  }): void =>
    - drawTypingBubble (line 450)
      - const drawTypingBubble = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, indicator: CanvasTypingIndicator): void =>
    - drawChatBubbleForSprite (line 464)
      - const drawChatBubbleForSprite = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, bubble: CanvasChatBubble): void =>
    - drawOccupant (line 477)
      - const drawOccupant = (context: CanvasRenderingContext2D, sprite: OccupantRenderState, assets: SpriteAssets | null): void =>
    - updateSpritePositions (line 508)
      - const updateSpritePositions = (sprites: Map<string, OccupantRenderState>, now: number, animationsEnabled: boolean): void =>
    - getAvatarVariantIndex (line 536)
      - const getAvatarVariantIndex = (occupant: CanvasOccupant): number =>
    - formatCoordinate (line 553)
      - const formatCoordinate = (value: number): string =>
    - GridCanvas (line 555)
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
    - loadAssets (line 628)
      - async const loadAssets = (): Promise<void> =>
    - loadItemAssets (line 666)
      - async const loadItemAssets = (): Promise<void> =>
    - renderFrame (line 855)
      - const renderFrame = (timestamp: number): void =>
    - handlePointerMove (line 1015)
      - const handlePointerMove = (event: PointerEvent): void =>
    - handlePointerLeave (line 1034)
      - const handlePointerLeave = (): void =>
    - handlePointerDown (line 1040)
      - const handlePointerDown = (event: PointerEvent): void =>
    - handleContextMenu (line 1057)
      - const handleContextMenu = (event: MouseEvent): void =>
    - getTileItems (line 1066)
      - const getTileItems = (tile: GridTile | null): CanvasItem[] =>

- **packages/client/src/canvas/types.ts**

- **packages/client/src/components/InventoryCard.tsx**
  - Exports: default
  - Functions:
    - InventoryCard (line 13)
      - const InventoryCard = ({ items }: InventoryCardProps): JSX.Element =>

- **packages/client/src/components/ProfilePanel.tsx**
  - Exports: default
  - Imports: ../ws/useRealtimeConnection
  - Functions:
    - ProfilePanel (line 15)
      - const ProfilePanel = ({ state, onRetry, onClose }: ProfilePanelProps): JSX.Element | null =>

- **packages/client/src/hooks/useActionToast.ts**
  - Exports: useActionToast
  - Imports: react
  - Functions:
    - useActionToast (line 15) [exported]
      - const useActionToast = (timeoutMs = 4000): UseActionToastResult =>

- **packages/client/src/main.tsx**
  - Imports: ./App.js, react, react-dom/client

- **packages/client/src/ws/useRealtimeConnection.ts**
  - Exports: useRealtimeConnection
  - Imports: @bitby/schemas, react, socket.io-client
  - Functions:
    - sortRoomItems (line 70)
      - const sortRoomItems = (items: Iterable<RoomItem>): RoomItem[] =>
    - sortInventoryItems (line 78)
      - const sortInventoryItems = (items: Iterable<InventoryItem>): InventoryItem[] =>
    - isSessionUser (line 108)
      - const isSessionUser = (value: unknown): value is SessionUser =>
    - isSessionRoom (line 123)
      - const isSessionRoom = (value: unknown): value is SessionRoom =>
    - cloneOccupant (line 250)
      - const cloneOccupant = (occupant: RoomOccupant): RoomOccupant =>
    - sortOccupants (line 256)
      - const sortOccupants = (map: Map<string, RoomOccupant>): RoomOccupant[] =>
    - buildEnvelope (line 267)
      - const buildEnvelope = (seq: number, op: string, data: Record<string, unknown> = {}): MessageEnvelope =>
    - normaliseSocketProtocol (line 283)
      - const normaliseSocketProtocol = (protocol: string): string =>
    - resolveSocketEndpoint (line 294)
      - const resolveSocketEndpoint = (): SocketEndpoint =>
    - resolveHttpBaseUrl (line 320)
      - const resolveHttpBaseUrl = (): string =>
    - getExplicitToken (line 335)
      - const getExplicitToken = (): string | null =>
    - getDevCredentials (line 340)
      - const getDevCredentials = (): { username: string; password: string } =>
    - getLatestPendingTarget (line 345)
      - const getLatestPendingTarget = (pendingMoves: Map<number, { to: { x: number; y: number } }>): { x: number; y: number } | null =>
    - normaliseTypingPreview (line 355)
      - const normaliseTypingPreview = (input: string | null | undefined): string | null =>
    - snapshotTypingIndicators (line 366)
      - const snapshotTypingIndicators = (source: Map<string, TypingIndicatorInternal>): TypingIndicatorView[] =>
    - snapshotChatBubbles (line 375)
      - const snapshotChatBubbles = (source: Map<string, ChatBubbleInternal>): ChatBubbleView[] =>
    - useRealtimeConnection (line 385) [exported]
      - const useRealtimeConnection = (): RealtimeConnectionState =>
    - clearPingTimer (line 445)
      - const clearPingTimer = () =>
    - clearCountdownTimer (line 452)
      - const clearCountdownTimer = () =>
    - clearTypingCleanupTimer (line 459)
      - const clearTypingCleanupTimer = () =>
    - clearBubbleCleanupTimer (line 466)
      - const clearBubbleCleanupTimer = () =>
    - abortLogin (line 473)
      - const abortLogin = () =>
    - clearActiveSocket (line 481)
      - const clearActiveSocket = () =>
    - startPingTimer (line 504)
      - const startPingTimer = (intervalMs: number) =>
    - updateState (line 520)
      - const updateState = (partial: Partial<InternalConnectionState>) =>
    - requestAuthToken (line 543)
      - async const requestAuthToken = (): Promise<string> =>
    - scheduleReconnect (line 638)
      - const scheduleReconnect = () =>
    - filterChatLogByMuted (line 698)
      - const filterChatLogByMuted = (log: ChatMessageBroadcast[], mutedIds: Set<string>): ChatMessageBroadcast[] =>
    - appendChatMessage (line 706)
      - const appendChatMessage = (message: ChatMessageBroadcast) =>
    - publishTypingIndicators (line 725)
      - const publishTypingIndicators = () =>
    - pruneTypingIndicators (line 729)
      - const pruneTypingIndicators = (now: number = Date.now()): void =>
    - scheduleTypingCleanup (line 742)
      - const scheduleTypingCleanup = () =>
    - upsertTypingIndicator (line 753)
      - const upsertTypingIndicator = (userId: string, preview: string | null, expiresAt?: number): void =>
    - removeTypingIndicator (line 770)
      - const removeTypingIndicator = (userId: string): void =>
    - publishChatBubbles (line 779)
      - const publishChatBubbles = () =>
    - pruneChatBubbles (line 783)
      - const pruneChatBubbles = (now: number = Date.now()): void =>
    - scheduleBubbleCleanup (line 796)
      - const scheduleBubbleCleanup = () =>
    - upsertChatBubble (line 807)
      - const upsertChatBubble = (userId: string, messageId: string, body: string): void =>
    - removeChatBubble (line 817)
      - const removeChatBubble = (userId: string): void =>
    - handleEnvelope (line 826)
      - const handleEnvelope = (envelope: MessageEnvelope) =>
    - connect (line 1476)
      - async const connect = () =>
    - detachListeners (line 1533)
      - const detachListeners = () =>

- **packages/client/vite.config.ts**
  - Exports: default
  - Imports: @vitejs/plugin-react, node:path, node:url, vite

- **packages/client/vitest.config.ts**
  - Exports: default
  - Imports: @vitejs/plugin-react, node:path, node:url, vitest/config

- **packages/client/vitest.setup.ts**
  - Imports: @testing-library/jest-dom/vitest

- **packages/schemas/src/index.ts**
  - Exports: *

- **packages/schemas/src/openapi/auth.ts**
  - Imports: openapi-types

- **packages/schemas/src/rest/occupants.ts**
  - Imports: zod

- **packages/schemas/src/ws/admin.ts**
  - Imports: zod

- **packages/schemas/src/ws/auth.ts**
  - Imports: zod

- **packages/schemas/src/ws/chat.ts**
  - Imports: ./envelope.js, zod

- **packages/schemas/src/ws/envelope.ts**
  - Exports: buildEnvelopeSchema
  - Imports: zod
  - Functions:
    - buildEnvelopeSchema (line 17) [exported]
      - const buildEnvelopeSchema = (dataSchema: Schema) =>

- **packages/schemas/src/ws/items.ts**
  - Exports: roomItemSchema
  - Imports: ./room.js, zod

- **packages/schemas/src/ws/move.ts**
  - Imports: ./envelope.js, zod

- **packages/schemas/src/ws/room.ts**
  - Imports: ./admin.js, zod

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

