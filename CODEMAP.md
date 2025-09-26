# CODEMAP

Generated at: 2025-09-26T21:29:09.402Z

## Module: Uncategorized

- **packages/client/src/App.tsx**
  - Exports: default
  - Imports: ./assets/items/couch.png, ./assets/items/plant.png, ./canvas/GridCanvas, ./canvas/geometry, ./canvas/types, ./components/InventoryCard, ./components/ProfilePanel, ./hooks/useActionToast, ./styles.css, ./ws/useRealtimeConnection, react
  - Functions:
    - adjustPosition (line 164)
      - const adjustPosition = (): void =>
    - renderTileSection (line 248)
      - const renderTileSection = (tile: GridTile, items: CanvasItem[], focusedItemId: string | null): JSX.Element =>
    - renderTileMenu (line 311)
      - const renderTileMenu = (payload: TileContextMenuState): JSX.Element =>
    - renderOccupantMenu (line 314)
      - const renderOccupantMenu = (payload: OccupantContextMenuState): JSX.Element =>
    - App (line 485)
      - const App = (): JSX.Element =>
    - isEditableElement (line 689)
      - const isEditableElement = (element: Element | null): boolean =>
    - commitDraft (line 702)
      - const commitDraft = (next: string) =>
    - handleGlobalKeyDown (line 712)
      - const handleGlobalKeyDown = (event: KeyboardEvent): void =>
    - buildSlots (line 926)
      - const buildSlots = (userId: string | null) =>
    - handleSlotChange (line 943)
      - const handleSlotChange = (slotIndex: number, value: string) =>
    - handleSlotClear (line 967)
      - const handleSlotClear = (slotIndex: number) =>
    - handleReadinessToggle (line 990)
      - const handleReadinessToggle = (next: boolean) =>
    - parseTimestamp (line 1190)
      - const parseTimestamp = (value?: string | null): number =>
    - handlePointerDown (line 1341)
      - const handlePointerDown = (event: PointerEvent): void =>
    - handleKeyDown (line 1360)
      - const handleKeyDown = (event: KeyboardEvent): void =>
    - handleScroll (line 1383)
      - const handleScroll = (): void =>
    - handleMenuButtonClick (line 1998)
      - const handleMenuButtonClick = (label: string): void =>

- **packages/client/src/canvas/constants.ts**

- **packages/client/src/canvas/geometry.ts**
  - Exports: buildGridDefinition, createTileKey, findTileAtPoint, getColumnsForRow, isPointInsideTile, toScreenPosition
  - Imports: ./constants, ./types
  - Functions:
    - createTileKey (line 17)
      - const createTileKey = (gridX: number, gridY: number): string =>
    - getColumnsForRow (line 19) [exported]
      - const getColumnsForRow = (row: number): number =>
    - getMaxColumns (line 22)
      - const getMaxColumns = (): number =>
    - getRowOffset (line 24)
      - const getRowOffset = (row: number): number =>
    - getRowRightSpan (line 29)
      - const getRowRightSpan = (row: number): number =>
    - computeMaxRowSpan (line 35)
      - const computeMaxRowSpan = (rowCount: number): number =>
    - buildGridDefinition (line 48) [exported]
      - const buildGridDefinition = (canvasWidth: number = CANVAS_WIDTH, canvasHeight: number = CANVAS_HEIGHT): GridDefinition =>
    - isPointInsideTile (line 113) [exported]
      - const isPointInsideTile = (tile: GridTile, px: number, py: number): boolean =>
    - findTileAtPoint (line 120) [exported]
      - const findTileAtPoint = (grid: GridDefinition, px: number, py: number): GridTile | null =>
    - toScreenPosition (line 167) [exported]
      - const toScreenPosition = (grid: GridDefinition, gridX: number, gridY: number): { x: number; y: number } =>

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

  - _Output truncated due to markdownMaxPerGroup limit._
