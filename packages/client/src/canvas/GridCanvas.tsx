import { useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';
import { buildGridDefinition, createTileKey, findTileAtPoint } from './geometry';
import type { GridDefinition, GridTile } from './types';
import devRoomUrl from '../assets/rooms/dev_room.png';
import avatar1Url from '../assets/avatars/avatar1.png';
import avatar2Url from '../assets/avatars/avatar2.png';

type CanvasOccupant = {
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

type GridCanvasProps = {
  occupants: CanvasOccupant[];
  tileFlags: TileFlag[];
  pendingMoveTarget: { x: number; y: number } | null;
  onTileClick?: (tile: GridTile) => void;
  localOccupantId?: string | null;
  showGrid: boolean;
  showHoverWhenGridHidden: boolean;
  moveAnimationsEnabled: boolean;
};

type PointerPosition = {
  x: number;
  y: number;
};

type SpriteAssets = {
  room: HTMLImageElement | null;
  avatars: HTMLImageElement[];
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
  localOccupantId = null,
  showGrid,
  showHoverWhenGridHidden,
  moveAnimationsEnabled,
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

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    let isMounted = true;

    const loadAssets = async (): Promise<void> => {
      try {
        const [roomImage, ...avatarImages] = await Promise.all([
          loadImage(devRoomUrl),
          ...AVATAR_SOURCES.map((source) => loadImage(source)),
        ]);

        if (isMounted) {
          setAssets({ room: roomImage, avatars: avatarImages });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to load canvas assets', error);
        }
        if (isMounted) {
          setAssets({ room: null, avatars: [] });
        }
      }
    };

    loadAssets().catch(() => {
      if (isMounted) {
        setAssets({ room: null, avatars: [] });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

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

        for (const sprite of orderedSprites) {
          drawOccupant(context, sprite, assetsRef.current);
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
      if (!onTileClick) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      const tile = findTileAtPoint(grid, x, y);
      if (tile) {
        onTileClick(tile);
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('pointerdown', handlePointerDown);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [grid, onTileClick]);

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
