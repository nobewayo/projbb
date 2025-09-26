import { useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';
import { buildGridDefinition, createTileKey, findTileAtPoint } from './geometry';
import type { GridDefinition, GridTile } from './types';
import devRoomUrl from '../assets/rooms/dev_room.png';
import avatar1Url from '../assets/avatars/avatar1.png';
import avatar2Url from '../assets/avatars/avatar2.png';

export type CanvasOccupant = {
  id: string;
  username: string;
  roles: string[];
  position: { x: number; y: number };
};

type TileFlag = {
  x: number;
  y: number;
  locked: boolean;
  noPickup: boolean;
};

export type CanvasItem = {
  id: string;
  name: string;
  description: string;
  tileX: number;
  tileY: number;
  texture: string;
};

export type CanvasTypingIndicator = {
  userId: string;
  preview: string | null;
  expiresAt: number;
};

export type CanvasChatBubble = {
  userId: string;
  messageId: string;
  body: string;
  expiresAt: number;
};

type GridCanvasProps = {
  occupants: CanvasOccupant[];
  tileFlags: TileFlag[];
  pendingMoveTarget: { x: number; y: number } | null;
  onTileClick?: (tile: GridTile) => void;
  items: CanvasItem[];
  onTileContextMenu?: (payload: {
    tile: GridTile;
    items: CanvasItem[];
    focusedItemId: string | null;
    clientX: number;
    clientY: number;
  }) => void;
  onItemContextMenu?: (payload: {
    tile: GridTile;
    item: CanvasItem;
    items: CanvasItem[];
    focusedItemId: string | null;
    clientX: number;
    clientY: number;
  }) => void;
  onOccupantContextMenu?: (payload: {
    occupant: CanvasOccupant;
    tile: GridTile;
    items: CanvasItem[];
    focusedItemId: string | null;
    clientX: number;
    clientY: number;
  }) => void;
  localOccupantId?: string | null;
  showGrid: boolean;
  showHoverWhenGridHidden: boolean;
  moveAnimationsEnabled: boolean;
  typingIndicators: CanvasTypingIndicator[];
  chatBubbles: CanvasChatBubble[];
};

type PointerPosition = {
  x: number;
  y: number;
};

type SpriteAssets = {
  room: HTMLImageElement | null;
  avatars: HTMLImageElement[];
  items: Map<string, HTMLImageElement>;
};

type ItemBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  item: CanvasItem;
};

type OccupantBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  occupant: CanvasOccupant;
};

type OccupantRenderState = {
  id: string;
  username: string;
  gridX: number;
  gridY: number;
  tileWidth: number;
  baseX: number;
  baseY: number;
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  duration: number;
  avatarIndex: number;
  isLocal: boolean;
};

const tileStroke = 'rgba(126, 178, 229, 0.52)';
const hoveredStroke = 'rgba(122, 209, 255, 0.9)';
const pendingStroke = 'rgba(242, 201, 76, 0.9)';
const lockedFill = 'rgba(209, 71, 94, 0.24)';
const noPickupFill = 'rgba(255, 200, 99, 0.2)';
const centerDot = '#5ec9ff';
const hoveredCenterDot = '#e8f6ff';
const usernameFill = 'rgba(20, 35, 54, 0.55)';
const hiddenHoverFill = 'rgba(255, 255, 255, 0.06)';
const hiddenHoverStroke = 'rgba(255, 255, 255, 0.18)';

const AVATAR_SOURCES: string[] = [avatar1Url, avatar2Url];
const MOVEMENT_DURATION_MS = 220;
const FOOT_OFFSET = 6;
const USERNAME_OFFSET = 2;
const FALLBACK_AVATAR_WIDTH = 48;
const FALLBACK_AVATAR_HEIGHT = 90;
const FALLBACK_ITEM_WIDTH = 96;
const FALLBACK_ITEM_HEIGHT = 96;
const ITEM_HIT_PADDING = 3;
const BUBBLE_MAX_WIDTH = 220;
const BUBBLE_PADDING_X = 12;
const BUBBLE_PADDING_Y = 8;
const BUBBLE_LINE_HEIGHT = 18;
const BUBBLE_CORNER_RADIUS = 14;
const BUBBLE_TAIL_HEIGHT = 12;
const BUBBLE_TAIL_WIDTH = 20;
const CHAT_BUBBLE_OFFSET = 82;
const TYPING_BUBBLE_OFFSET = 90;
const CHAT_BUBBLE_FILL = 'rgba(255, 255, 255, 0.96)';
const TYPING_BUBBLE_FILL = 'rgba(255, 255, 255, 0.9)';
const BUBBLE_STROKE = 'rgba(22, 52, 88, 0.14)';
const CHAT_TEXT_COLOR = '#152437';
const TYPING_TEXT_COLOR = '#243b5a';
const BUBBLE_MARGIN = 12;

const loadImage = async (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const prepareContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const dpr = window.devicePixelRatio ?? 1;
  const width = Math.round(CANVAS_WIDTH * dpr);
  const height = Math.round(CANVAS_HEIGHT * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
  }

  context.save();
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return context;
};

const drawBackground = (
  context: CanvasRenderingContext2D,
  assets: SpriteAssets | null,
): void => {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (assets?.room) {
    context.drawImage(assets.room, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
};

const traceDiamond = (context: CanvasRenderingContext2D, tile: GridTile): void => {
  context.beginPath();
  context.moveTo(tile.centerX, tile.screenY);
  context.lineTo(tile.screenX + tile.width, tile.centerY);
  context.lineTo(tile.centerX, tile.screenY + tile.height);
  context.lineTo(tile.screenX, tile.centerY);
  context.closePath();
};

const drawTile = (
  context: CanvasRenderingContext2D,
  tile: GridTile,
  options: { hovered: boolean; locked: boolean; pending: boolean; noPickup: boolean },
): void => {
  context.save();

  traceDiamond(context, tile);
  if (options.locked) {
    context.fillStyle = lockedFill;
    context.fill();
    traceDiamond(context, tile);
  } else if (options.noPickup) {
    context.fillStyle = noPickupFill;
    context.fill();
    traceDiamond(context, tile);
  }

  context.setLineDash([]);
  context.lineWidth = options.hovered ? 2 : 1;
  context.strokeStyle = options.hovered ? hoveredStroke : tileStroke;
  context.stroke();

  if (options.pending) {
    traceDiamond(context, tile);
    context.setLineDash([6, 4]);
    context.lineWidth = 2;
    context.strokeStyle = pendingStroke;
    context.stroke();
  }

  context.restore();

  context.beginPath();
  context.fillStyle = options.hovered ? hoveredCenterDot : centerDot;
  context.arc(tile.centerX, tile.centerY, options.hovered ? 3 : 2, 0, Math.PI * 2);
  context.fill();
};

const drawHiddenHoverTile = (
  context: CanvasRenderingContext2D,
  tile: GridTile,
): void => {
  context.save();
  traceDiamond(context, tile);
  context.fillStyle = hiddenHoverFill;
  context.fill();
  traceDiamond(context, tile);
  context.lineWidth = 1;
  context.strokeStyle = hiddenHoverStroke;
  context.stroke();
  context.restore();
};

const drawUsername = (
  context: CanvasRenderingContext2D,
  sprite: OccupantRenderState,
): void => {
  const labelY = sprite.currentY + USERNAME_OFFSET;

  context.save();
  context.font = '14px "Inter", "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  context.fillStyle = usernameFill;
  context.fillText(sprite.username, sprite.currentX, labelY);
  context.restore();
};

const splitLongWord = (
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
): string[] => {
  const segments: string[] = [];
  let buffer = '';
  for (const char of word) {
    const candidate = buffer + char;
    if (context.measureText(candidate).width > maxWidth && buffer.length > 0) {
      segments.push(buffer);
      buffer = char;
    } else {
      buffer = candidate;
    }
  }

  if (buffer.length > 0) {
    segments.push(buffer);
  }

  return segments;
};

const wrapBubbleLines = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  if (!text || text.trim().length === 0) {
    return ['…'];
  }

  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return ['…'];
  }

  const lines: string[] = [];
  let currentLine = '';

  const pushLine = (line: string) => {
    if (line.length > 0) {
      lines.push(line);
    }
  };

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
      continue;
    }

    if (context.measureText(word).width > maxWidth) {
      const segments = splitLongWord(context, word, maxWidth);
      if (currentLine.length > 0) {
        pushLine(currentLine);
        currentLine = '';
      }
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        if (context.measureText(segment).width <= maxWidth) {
          if (segment.length === 0) {
            continue;
          }
          if (index === segments.length - 1) {
            currentLine = segment;
          } else {
            pushLine(segment);
          }
        }
      }
      continue;
    }

    pushLine(currentLine);
    currentLine = word;
  }

  if (currentLine.length > 0) {
    pushLine(currentLine);
  }

  return lines.length > 0 ? lines : ['…'];
};

const drawSpeechBubble = (
  context: CanvasRenderingContext2D,
  sprite: OccupantRenderState,
  options: {
    text: string;
    fill: string;
    textColor: string;
    offset: number;
  },
): void => {
  context.save();
  context.font = '14px "Inter", "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const maxLineWidth = BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2;
  const lines = wrapBubbleLines(context, options.text, maxLineWidth);
  let measuredWidth = 0;
  for (const line of lines) {
    measuredWidth = Math.max(measuredWidth, context.measureText(line).width);
  }

  const bubbleWidth = Math.min(BUBBLE_MAX_WIDTH, measuredWidth + BUBBLE_PADDING_X * 2);
  const bubbleHeight = lines.length * BUBBLE_LINE_HEIGHT + BUBBLE_PADDING_Y * 2;
  const tailBaseY = sprite.currentY - options.offset;
  const bodyBottom = tailBaseY - BUBBLE_TAIL_HEIGHT;
  let left = sprite.currentX - bubbleWidth / 2;
  left = Math.max(BUBBLE_MARGIN, Math.min(left, CANVAS_WIDTH - BUBBLE_MARGIN - bubbleWidth));
  const right = left + bubbleWidth;
  const top = bodyBottom - bubbleHeight;
  const tailAnchorX = Math.max(
    left + BUBBLE_CORNER_RADIUS,
    Math.min(right - BUBBLE_CORNER_RADIUS, sprite.currentX),
  );
  const tailLeft = tailAnchorX - BUBBLE_TAIL_WIDTH / 2;
  const tailRight = tailAnchorX + BUBBLE_TAIL_WIDTH / 2;

  context.beginPath();
  context.moveTo(left + BUBBLE_CORNER_RADIUS, top);
  context.lineTo(right - BUBBLE_CORNER_RADIUS, top);
  context.quadraticCurveTo(right, top, right, top + BUBBLE_CORNER_RADIUS);
  context.lineTo(right, bodyBottom - BUBBLE_CORNER_RADIUS);
  context.quadraticCurveTo(right, bodyBottom, right - BUBBLE_CORNER_RADIUS, bodyBottom);
  context.lineTo(tailRight, bodyBottom);
  context.lineTo(sprite.currentX, tailBaseY);
  context.lineTo(tailLeft, bodyBottom);
  context.lineTo(left + BUBBLE_CORNER_RADIUS, bodyBottom);
  context.quadraticCurveTo(left, bodyBottom, left, bodyBottom - BUBBLE_CORNER_RADIUS);
  context.lineTo(left, top + BUBBLE_CORNER_RADIUS);
  context.quadraticCurveTo(left, top, left + BUBBLE_CORNER_RADIUS, top);
  context.closePath();

  context.fillStyle = options.fill;
  context.shadowColor = 'rgba(20, 32, 54, 0.25)';
  context.shadowBlur = 14;
  context.shadowOffsetY = 4;
  context.fill();

  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.lineWidth = 1;
  context.strokeStyle = BUBBLE_STROKE;
  context.stroke();

  context.fillStyle = options.textColor;
  const firstLineY = top + BUBBLE_PADDING_Y + BUBBLE_LINE_HEIGHT / 2;
  const textCenterX = (left + right) / 2;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const textY = firstLineY + index * BUBBLE_LINE_HEIGHT;
    context.fillText(line, textCenterX, textY);
  }

  context.restore();
};

const drawTypingBubble = (
  context: CanvasRenderingContext2D,
  sprite: OccupantRenderState,
  indicator: CanvasTypingIndicator,
): void => {
  const text = indicator.preview && indicator.preview.trim().length > 0 ? indicator.preview : '…';
  drawSpeechBubble(context, sprite, {
    text,
    fill: TYPING_BUBBLE_FILL,
    textColor: TYPING_TEXT_COLOR,
    offset: TYPING_BUBBLE_OFFSET,
  });
};

const drawChatBubbleForSprite = (
  context: CanvasRenderingContext2D,
  sprite: OccupantRenderState,
  bubble: CanvasChatBubble,
): void => {
  drawSpeechBubble(context, sprite, {
    text: bubble.body,
    fill: CHAT_BUBBLE_FILL,
    textColor: CHAT_TEXT_COLOR,
    offset: CHAT_BUBBLE_OFFSET,
  });
};

const drawOccupant = (
  context: CanvasRenderingContext2D,
  sprite: OccupantRenderState,
  assets: SpriteAssets | null,
): void => {
  const avatarImages = assets?.avatars ?? [];
  const avatarImage = avatarImages[sprite.avatarIndex] ?? null;
  const avatarWidth = avatarImage?.width ?? FALLBACK_AVATAR_WIDTH;
  const avatarHeight = avatarImage?.height ?? FALLBACK_AVATAR_HEIGHT;
  const drawX = sprite.currentX - avatarWidth / 2;
  const drawY = sprite.currentY - avatarHeight;

  drawUsername(context, sprite);

  if (avatarImage) {
    context.drawImage(avatarImage, drawX, drawY, avatarWidth, avatarHeight);
    return;
  }

  context.save();
  context.fillStyle = sprite.isLocal ? '#ffd166' : '#5fa8ff';
  context.beginPath();
  context.moveTo(drawX, drawY + 12);
  context.lineTo(drawX + avatarWidth, drawY + 12);
  context.lineTo(sprite.currentX + avatarWidth * 0.35 - avatarWidth / 2, sprite.currentY);
  context.lineTo(sprite.currentX - avatarWidth * 0.35 + avatarWidth / 2, sprite.currentY);
  context.closePath();
  context.fill();
  context.restore();
};

const updateSpritePositions = (
  sprites: Map<string, OccupantRenderState>,
  now: number,
  animationsEnabled: boolean,
): void => {
  for (const sprite of sprites.values()) {
    if (!animationsEnabled || sprite.duration <= 0) {
      sprite.currentX = sprite.targetX;
      sprite.currentY = sprite.targetY;
      sprite.duration = 0;
      continue;
    }

    const elapsed = now - sprite.startTime;
    const progress = Math.min(Math.max(elapsed / sprite.duration, 0), 1);
    const eased = easeOutCubic(progress);

    sprite.currentX = sprite.startX + (sprite.targetX - sprite.startX) * eased;
    sprite.currentY = sprite.startY + (sprite.targetY - sprite.startY) * eased;

    if (progress >= 1) {
      sprite.duration = 0;
      sprite.currentX = sprite.targetX;
      sprite.currentY = sprite.targetY;
    }
  }
};

const getAvatarVariantIndex = (occupant: CanvasOccupant): number => {
  if (occupant.roles.includes('npc')) {
    return AVATAR_SOURCES.length > 1 ? 1 : 0;
  }

  if (AVATAR_SOURCES.length === 0) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < occupant.id.length; index += 1) {
    hash = (hash * 31 + occupant.id.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % AVATAR_SOURCES.length;
};

const formatCoordinate = (value: number): string => value.toFixed(0);

const GridCanvas = ({
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
}: GridCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grid = useMemo<GridDefinition>(() => buildGridDefinition(), []);
  const [hoveredTile, setHoveredTile] = useState<GridTile | null>(null);
  const hoveredTileRef = useRef<GridTile | null>(null);
  const [pointer, setPointer] = useState<PointerPosition | null>(null);
  const [assets, setAssets] = useState<SpriteAssets | null>(null);
  const assetsRef = useRef<SpriteAssets | null>(null);
  const occupantSpritesRef = useRef<Map<string, OccupantRenderState>>(new Map());
  const animationFrameRef = useRef<number | null>(null);
  const showGridRef = useRef(showGrid);
  const showHoverWhenGridHiddenRef = useRef(showHoverWhenGridHidden);
  const moveAnimationsEnabledRef = useRef(moveAnimationsEnabled);
  const itemsRef = useRef<CanvasItem[]>(items);
  const itemBoundsRef = useRef<Map<string, ItemBounds>>(new Map());
  const itemDrawOrderRef = useRef<string[]>([]);
  const occupantBoundsRef = useRef<Map<string, OccupantBounds>>(new Map());
  const occupantDrawOrderRef = useRef<string[]>([]);
  const occupantTargetsRef = useRef<Map<string, { occupant: CanvasOccupant; tile: GridTile }>>(new Map());
  const typingIndicatorsRef = useRef<Map<string, CanvasTypingIndicator>>(new Map());
  const chatBubblesRef = useRef<Map<string, CanvasChatBubble>>(new Map());
  const occupantTargets = useMemo(() => {
    const entries = new Map<string, { occupant: CanvasOccupant; tile: GridTile }>();
    for (const occupant of occupants) {
      const tile = grid.tileMap.get(createTileKey(occupant.position.x, occupant.position.y));
      if (!tile) {
        continue;
      }
      entries.set(occupant.id, { occupant, tile });
    }
    return entries;
  }, [grid, occupants]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    occupantTargetsRef.current = occupantTargets;
  }, [occupantTargets]);

  useEffect(() => {
    typingIndicatorsRef.current = new Map(
      typingIndicators.map((indicator) => [indicator.userId, indicator]),
    );
  }, [typingIndicators]);

  useEffect(() => {
    chatBubblesRef.current = new Map(chatBubbles.map((bubble) => [bubble.userId, bubble]));
  }, [chatBubbles]);

  useEffect(() => {
    let isMounted = true;

    const loadAssets = async (): Promise<void> => {
      try {
        const [roomImage, ...avatarImages] = await Promise.all([
          loadImage(devRoomUrl),
          ...AVATAR_SOURCES.map((source) => loadImage(source)),
        ]);

        if (isMounted) {
          setAssets({
            room: roomImage,
            avatars: avatarImages,
            items: new Map(assetsRef.current?.items ?? []),
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to load canvas assets', error);
        }
        if (isMounted) {
          setAssets({ room: null, avatars: [], items: new Map() });
        }
      }
    };

    loadAssets().catch(() => {
      if (isMounted) {
        setAssets({ room: null, avatars: [], items: new Map() });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadItemAssets = async (): Promise<void> => {
      const uniqueTextures = Array.from(new Set(items.map((item) => item.texture)));
      const currentItems = assetsRef.current?.items ?? new Map<string, HTMLImageElement>();
      const nextItems = new Map(currentItems);
      const texturesToLoad = uniqueTextures.filter((texture) => !nextItems.has(texture));

      if (texturesToLoad.length === 0) {
        if (isMounted) {
          setAssets((previous) => {
            if (!previous) {
              return { room: null, avatars: [], items: nextItems };
            }
            return { ...previous, items: nextItems };
          });
        }
        return;
      }

      try {
        const loadedImages = await Promise.all(texturesToLoad.map((texture) => loadImage(texture)));
        texturesToLoad.forEach((texture, index) => {
          nextItems.set(texture, loadedImages[index]);
        });
        if (isMounted) {
          setAssets((previous) => {
            if (!previous) {
              return { room: null, avatars: [], items: nextItems };
            }
            return { ...previous, items: nextItems };
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to load item textures', error);
        }
      }
    };

    loadItemAssets().catch(() => {
      if (isMounted) {
        setAssets((previous) => {
          if (!previous) {
            return { room: null, avatars: [], items: new Map() };
          }
          return { ...previous, items: new Map(previous.items) };
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [items]);

  useEffect(() => {
    hoveredTileRef.current = hoveredTile;
  }, [hoveredTile]);

  useEffect(() => {
    showGridRef.current = showGrid;
  }, [showGrid]);

  useEffect(() => {
    showHoverWhenGridHiddenRef.current = showHoverWhenGridHidden;
  }, [showHoverWhenGridHidden]);

  useEffect(() => {
    moveAnimationsEnabledRef.current = moveAnimationsEnabled;
  }, [moveAnimationsEnabled]);


  const lockedTileKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const flag of tileFlags) {
      if (flag.locked) {
        keys.add(createTileKey(flag.x, flag.y));
      }
    }
    return keys;
  }, [tileFlags]);

  const noPickupTileKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const flag of tileFlags) {
      if (flag.noPickup && !flag.locked) {
        keys.add(createTileKey(flag.x, flag.y));
      }
    }
    return keys;
  }, [tileFlags]);

  const pendingTileKey = useMemo(() => {
    if (!pendingMoveTarget) {
      return null;
    }
    return createTileKey(pendingMoveTarget.x, pendingMoveTarget.y);
  }, [pendingMoveTarget]);

  const lockedTilesRef = useRef(lockedTileKeys);
  const noPickupTilesRef = useRef(noPickupTileKeys);
  const pendingTileKeyRef = useRef<string | null>(pendingTileKey);

  useEffect(() => {
    lockedTilesRef.current = lockedTileKeys;
  }, [lockedTileKeys]);

  useEffect(() => {
    noPickupTilesRef.current = noPickupTileKeys;
  }, [noPickupTileKeys]);

  useEffect(() => {
    pendingTileKeyRef.current = pendingTileKey;
  }, [pendingTileKey]);

  useEffect(() => {
    const sprites = occupantSpritesRef.current;
    const now = performance.now();
    const localId = localOccupantId ?? null;

    for (const id of Array.from(sprites.keys())) {
      if (!occupantTargets.has(id)) {
        sprites.delete(id);
      }
    }

    for (const [id, entry] of occupantTargets.entries()) {
      const { occupant, tile } = entry;
      const baseX = tile.centerX;
      const baseY = tile.screenY + tile.height - FOOT_OFFSET;
      const avatarIndex = getAvatarVariantIndex(occupant);
      const existing = sprites.get(id);

      if (!existing) {
        sprites.set(id, {
          id,
          username: occupant.username,
          gridX: tile.gridX,
          gridY: tile.gridY,
          tileWidth: tile.width,
          baseX,
          baseY,
          currentX: baseX,
          currentY: baseY,
          startX: baseX,
          startY: baseY,
          targetX: baseX,
          targetY: baseY,
          startTime: now,
          duration: 0,
          avatarIndex,
          isLocal: occupant.id === localId,
        });
        continue;
      }

      existing.username = occupant.username;
      existing.gridX = tile.gridX;
      existing.gridY = tile.gridY;
      existing.tileWidth = tile.width;
      existing.baseX = baseX;
      existing.baseY = baseY;
      existing.isLocal = occupant.id === localId;
      existing.avatarIndex = avatarIndex;

      if (existing.targetX !== baseX || existing.targetY !== baseY) {
        existing.startX = existing.currentX;
        existing.startY = existing.currentY;
        existing.startTime = now;
        existing.targetX = baseX;
        existing.targetY = baseY;
        existing.duration = moveAnimationsEnabledRef.current
          ? MOVEMENT_DURATION_MS
          : 0;
      } else if (!moveAnimationsEnabledRef.current || existing.duration <= 0) {
        existing.currentX = baseX;
        existing.currentY = baseY;
        existing.duration = 0;
      }
    }
  }, [occupantTargets, localOccupantId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;

    const renderFrame = (timestamp: number): void => {
      if (disposed) {
        return;
      }

      const context = prepareContext(canvas);
      if (!context) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      try {
        updateSpritePositions(
          occupantSpritesRef.current,
          timestamp,
          moveAnimationsEnabledRef.current,
        );

        drawBackground(context, assetsRef.current);

        itemBoundsRef.current.clear();
        itemDrawOrderRef.current = [];
        const sortedItems = [...itemsRef.current].sort((a, b) => {
          if (a.tileY === b.tileY) {
            return a.tileX - b.tileX;
          }
          return a.tileY - b.tileY;
        });

        for (const item of sortedItems) {
          const tile = grid.tileMap.get(createTileKey(item.tileX, item.tileY));
          if (!tile) {
            continue;
          }

          const asset = assetsRef.current?.items.get(item.texture) ?? null;
          const width = asset?.width ?? FALLBACK_ITEM_WIDTH;
          const height = asset?.height ?? FALLBACK_ITEM_HEIGHT;
          const baseX = tile.centerX;
          const baseY = tile.screenY + tile.height;
          const drawX = Math.round(baseX - width / 2);
          const drawY = Math.round(baseY - height);

          if (asset) {
            context.drawImage(asset, drawX, drawY, width, height);
          } else {
            context.save();
            context.fillStyle = 'rgba(255, 255, 255, 0.82)';
            context.strokeStyle = 'rgba(20, 35, 54, 0.35)';
            context.lineWidth = 2;
            context.fillRect(drawX, drawY, width, height);
            context.strokeRect(drawX, drawY, width, height);
            context.fillStyle = 'rgba(20, 35, 54, 0.78)';
            context.font = '14px "Inter", "Segoe UI", sans-serif';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const label = item.name.length > 24 ? `${item.name.slice(0, 21)}…` : item.name;
            context.fillText(label, drawX + width / 2, drawY + height / 2, width - 12);
            context.restore();
          }

          itemBoundsRef.current.set(item.id, {
            x: drawX - ITEM_HIT_PADDING,
            y: drawY - ITEM_HIT_PADDING,
            width: width + ITEM_HIT_PADDING * 2,
            height: height + ITEM_HIT_PADDING * 2,
            item,
          });
          itemDrawOrderRef.current.push(item.id);
        }

        if (showGridRef.current) {
          for (const tile of grid.tiles) {
            drawTile(context, tile, {
              hovered: hoveredTileRef.current?.key === tile.key,
              locked: lockedTilesRef.current.has(tile.key),
              pending: pendingTileKeyRef.current === tile.key,
              noPickup:
                !lockedTilesRef.current.has(tile.key) &&
                noPickupTilesRef.current.has(tile.key),
            });
          }
        } else if (showHoverWhenGridHiddenRef.current) {
          const hovered = hoveredTileRef.current;
          if (
            hovered &&
            !lockedTilesRef.current.has(hovered.key)
          ) {
            drawHiddenHoverTile(context, hovered);
          }
        }

        const orderedSprites = Array.from(occupantSpritesRef.current.values()).sort((a, b) => {
          if (a.gridY === b.gridY) {
            return a.gridX - b.gridX;
          }
          return a.gridY - b.gridY;
        });

        occupantBoundsRef.current.clear();
        occupantDrawOrderRef.current = [];

        for (const sprite of orderedSprites) {
          const avatarImage =
            (sprite.avatarIndex >= 0
              ? assetsRef.current?.avatars[sprite.avatarIndex] ?? null
              : null);
          const avatarWidth = avatarImage?.width ?? FALLBACK_AVATAR_WIDTH;
          const avatarHeight = avatarImage?.height ?? FALLBACK_AVATAR_HEIGHT;
          const drawX = Math.round(sprite.currentX - avatarWidth / 2);
          const drawY = Math.round(sprite.currentY - avatarHeight + FOOT_OFFSET);

          drawOccupant(context, sprite, assetsRef.current);

          const typingIndicator = typingIndicatorsRef.current.get(sprite.id);
          if (typingIndicator) {
            drawTypingBubble(context, sprite, typingIndicator);
          } else {
            const bubble = chatBubblesRef.current.get(sprite.id);
            if (bubble) {
              drawChatBubbleForSprite(context, sprite, bubble);
            }
          }

          const occupantTarget = occupantTargetsRef.current.get(sprite.id);
          if (occupantTarget) {
            occupantBoundsRef.current.set(sprite.id, {
              x: drawX,
              y: drawY,
              width: avatarWidth,
              height: avatarHeight,
              occupant: occupantTarget.occupant,
            });
            occupantDrawOrderRef.current.push(sprite.id);
          }
        }
      } finally {
        context.restore();
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [grid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      const tile = findTileAtPoint(grid, x, y);
      setHoveredTile((previous) => {
        if (previous?.key === tile?.key) {
          return previous;
        }
        return tile;
      });
      hoveredTileRef.current = tile;

      setPointer({ x, y });
    };

    const handlePointerLeave = (): void => {
      setHoveredTile(null);
      hoveredTileRef.current = null;
      setPointer(null);
    };

    const handlePointerDown = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      if (!onTileClick || event.button !== 0) {
        return;
      }

      const tile = findTileAtPoint(grid, x, y);
      if (tile) {
        onTileClick(tile);
      }
    };

    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      const getTileItems = (tile: GridTile | null): CanvasItem[] =>
        tile
          ? itemsRef.current.filter(
              (item) => item.tileX === tile.gridX && item.tileY === tile.gridY,
            )
          : [];

      let occupantHit: { occupant: CanvasOccupant; tile: GridTile } | null = null;
      for (let index = occupantDrawOrderRef.current.length - 1; index >= 0; index -= 1) {
        const id = occupantDrawOrderRef.current[index];
        if (!id) {
          continue;
        }
        const bounds = occupantBoundsRef.current.get(id);
        if (
          bounds &&
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
        ) {
          const tile = occupantTargetsRef.current.get(id)?.tile ?? null;
          if (tile) {
            occupantHit = { occupant: bounds.occupant, tile };
          }
          break;
        }
      }

      let itemHit: { item: CanvasItem; tile: GridTile | null } | null = null;
      for (let index = itemDrawOrderRef.current.length - 1; index >= 0; index -= 1) {
        const id = itemDrawOrderRef.current[index];
        if (!id) {
          continue;
        }
        const bounds = itemBoundsRef.current.get(id);
        if (
          bounds &&
          x >= bounds.x &&
          x <= bounds.x + bounds.width &&
          y >= bounds.y &&
          y <= bounds.y + bounds.height
        ) {
          const tile =
            grid.tileMap.get(createTileKey(bounds.item.tileX, bounds.item.tileY)) ?? null;
          itemHit = { item: bounds.item, tile };
          break;
        }
      }

      const pointerTile = findTileAtPoint(grid, x, y);
      const occupantTile = occupantHit?.tile ?? null;
      const itemTile = itemHit?.tile ?? null;
      const fallbackTile = pointerTile ?? itemTile ?? occupantTile;
      const focusedItemId = itemHit?.item.id ?? null;

      if (occupantHit && onOccupantContextMenu) {
        const occupantItems = getTileItems(occupantTile);
        const occupantTileForMenu = occupantTile ?? fallbackTile;
        if (!occupantTileForMenu) {
          return;
        }
        const occupantFocused =
          focusedItemId && occupantItems.some((candidate) => candidate.id === focusedItemId)
            ? focusedItemId
            : null;
        onOccupantContextMenu({
          occupant: occupantHit.occupant,
          tile: occupantTileForMenu,
          items: occupantItems,
          focusedItemId: occupantFocused,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }

      if (itemHit && itemTile && onItemContextMenu) {
        const tileItems = getTileItems(itemTile);
        onItemContextMenu({
          tile: itemTile,
          item: itemHit.item,
          items: tileItems,
          focusedItemId: tileItems.some((candidate) => candidate.id === focusedItemId)
            ? focusedItemId
            : null,
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }

      const resolvedTile = fallbackTile;
      if (resolvedTile && onTileContextMenu) {
        const tileItems = getTileItems(resolvedTile);
        onTileContextMenu({
          tile: resolvedTile,
          items: tileItems,
          focusedItemId: tileItems.some((candidate) => candidate.id === focusedItemId)
            ? focusedItemId
            : null,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [
    grid,
    onTileClick,
    onItemContextMenu,
    onTileContextMenu,
    onOccupantContextMenu,
  ]);

  return (
    <div className="grid-canvas" aria-hidden={false}>
      <canvas ref={canvasRef} className="grid-canvas__surface" aria-hidden />
      <div className="grid-canvas__hud" aria-live="polite">
        <div className="grid-canvas__hud-column">
          <span className="grid-canvas__hud-label">Tile</span>
          <span className="grid-canvas__hud-value">
            {hoveredTile ? `${hoveredTile.gridX}, ${hoveredTile.gridY}` : '—'}
          </span>
        </div>
        <div className="grid-canvas__hud-column">
          <span className="grid-canvas__hud-label">Center</span>
          <span className="grid-canvas__hud-value">
            {hoveredTile
              ? `${formatCoordinate(hoveredTile.centerX)}, ${formatCoordinate(hoveredTile.centerY)}`
              : '—'}
          </span>
        </div>
        <div className="grid-canvas__hud-column">
          <span className="grid-canvas__hud-label">Pointer</span>
          <span className="grid-canvas__hud-value">
            {pointer
              ? `${formatCoordinate(pointer.x)}, ${formatCoordinate(pointer.y)}`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GridCanvas;
