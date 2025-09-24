import { useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './constants';
import { buildGridDefinition, createTileKey, findTileAtPoint } from './geometry';
import type { GridDefinition, GridTile } from './types';

interface CanvasOccupant {
  id: string;
  username: string;
  roles: string[];
  position: { x: number; y: number };
}

interface TileFlag {
  x: number;
  y: number;
  locked: boolean;
  noPickup: boolean;
}

interface GridCanvasProps {
  occupants: CanvasOccupant[];
  tileFlags: TileFlag[];
  pendingMoveTarget: { x: number; y: number } | null;
  onTileClick?: (tile: GridTile) => void;
  localOccupantId?: string | null;
}

interface PointerPosition {
  x: number;
  y: number;
}

const tileStroke = 'rgba(126, 178, 229, 0.52)';
const hoveredStroke = 'rgba(122, 209, 255, 0.9)';
const pendingStroke = 'rgba(242, 201, 76, 0.9)';
const lockedFill = 'rgba(209, 71, 94, 0.24)';
const noPickupFill = 'rgba(255, 200, 99, 0.2)';
const centerDot = '#5ec9ff';
const hoveredCenterDot = '#e8f6ff';
const localOccupantFill = '#ffd166';
const localOccupantAccent = '#f49d37';
const remoteOccupantFill = '#5fa8ff';
const remoteOccupantAccent = '#2c6dcf';

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

const drawBackground = (context: CanvasRenderingContext2D): void => {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
};

const drawTile = (
  context: CanvasRenderingContext2D,
  tile: GridTile,
  options: { hovered: boolean; locked: boolean; pending: boolean; noPickup: boolean },
): void => {
  const centerX = tile.centerX;
  const centerY = tile.centerY;

  const traceDiamond = () => {
    context.beginPath();
    context.moveTo(centerX, tile.screenY);
    context.lineTo(tile.screenX + tile.width, centerY);
    context.lineTo(centerX, tile.screenY + tile.height);
    context.lineTo(tile.screenX, centerY);
    context.closePath();
  };

  context.save();

  traceDiamond();
  if (options.locked || options.noPickup) {
    context.fillStyle = options.locked ? lockedFill : noPickupFill;
    context.fill();
  }

  traceDiamond();
  context.setLineDash([]);
  context.lineWidth = options.hovered ? 2 : 1;
  context.strokeStyle = options.hovered ? hoveredStroke : tileStroke;
  context.stroke();

  if (options.pending) {
    traceDiamond();
    context.setLineDash([6, 4]);
    context.lineWidth = 2;
    context.strokeStyle = pendingStroke;
    context.stroke();
  }

  context.restore();

  context.beginPath();
  context.fillStyle = options.hovered ? hoveredCenterDot : centerDot;
  context.arc(centerX, centerY, options.hovered ? 3 : 2, 0, Math.PI * 2);
  context.fill();
};

const renderGrid = (
  context: CanvasRenderingContext2D,
  grid: GridDefinition,
  hoveredTile: GridTile | null,
  lockedTiles: Set<string>,
  noPickupTiles: Set<string>,
  pendingTileKey: string | null,
  occupants: Array<{ tile: GridTile; occupant: CanvasOccupant }>,
  localOccupantId: string | null,
): void => {
  drawBackground(context);

  for (const tile of grid.tiles) {
    drawTile(context, tile, {
      hovered: hoveredTile?.key === tile.key,
      locked: lockedTiles.has(tile.key),
      noPickup: noPickupTiles.has(tile.key) && !lockedTiles.has(tile.key),
      pending: pendingTileKey === tile.key,
    });
  }

  for (const sprite of occupants) {
    const isLocal = sprite.occupant.id === localOccupantId;
    const baseX = sprite.tile.centerX;
    const baseY = sprite.tile.screenY + sprite.tile.height - 6;

    context.save();

    context.fillStyle = 'rgba(0, 0, 0, 0.28)';
    context.beginPath();
    context.ellipse(baseX, baseY, sprite.tile.width * 0.3, 10, 0, 0, Math.PI * 2);
    context.fill();

    const bodyWidth = 28;
    const bodyHeight = 50;
    const bodyTop = baseY - bodyHeight;
    const radius = 12;

    context.fillStyle = isLocal ? localOccupantFill : remoteOccupantFill;
    context.beginPath();
    context.moveTo(baseX - bodyWidth / 2, bodyTop + radius);
    context.quadraticCurveTo(baseX - bodyWidth / 2, bodyTop, baseX - bodyWidth / 2 + radius, bodyTop);
    context.lineTo(baseX + bodyWidth / 2 - radius, bodyTop);
    context.quadraticCurveTo(baseX + bodyWidth / 2, bodyTop, baseX + bodyWidth / 2, bodyTop + radius);
    context.lineTo(baseX + bodyWidth / 2, baseY - radius * 0.6);
    context.quadraticCurveTo(baseX + bodyWidth / 2, baseY, baseX + bodyWidth / 2 - radius, baseY);
    context.lineTo(baseX - bodyWidth / 2 + radius, baseY);
    context.quadraticCurveTo(baseX - bodyWidth / 2, baseY, baseX - bodyWidth / 2, baseY - radius * 0.6);
    context.closePath();
    context.fill();

    context.fillStyle = isLocal ? localOccupantAccent : remoteOccupantAccent;
    context.beginPath();
    context.arc(baseX, bodyTop, 14, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }
};

const formatCoordinate = (value: number): string => value.toFixed(0);

const GridCanvas = ({
  occupants,
  tileFlags,
  pendingMoveTarget,
  onTileClick,
  localOccupantId = null,
}: GridCanvasProps): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grid = useMemo(() => buildGridDefinition(), []);
  const [hoveredTile, setHoveredTile] = useState<GridTile | null>(null);
  const [pointer, setPointer] = useState<PointerPosition | null>(null);

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

  const occupantSprites = useMemo(() =>
    occupants
      .map((occupant) => {
        const tile = grid.tileMap.get(createTileKey(occupant.position.x, occupant.position.y));
        if (!tile) {
          return null;
        }
        return { tile, occupant };
      })
      .filter((value): value is { tile: GridTile; occupant: CanvasOccupant } => value !== null),
  [grid, occupants]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = prepareContext(canvas);
    if (!context) {
      return;
    }

    renderGrid(
      context,
      grid,
      hoveredTile,
      lockedTileKeys,
      noPickupTileKeys,
      pendingTileKey,
      occupantSprites,
      localOccupantId,
    );
    context.restore();
  }, [
    grid,
    hoveredTile,
    lockedTileKeys,
    noPickupTileKeys,
    pendingTileKey,
    occupantSprites,
    localOccupantId,
  ]);

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

      setPointer({ x, y });

      const tile = findTileAtPoint(grid, x, y);
      setHoveredTile((previous) => {
        if (previous?.key === tile?.key) {
          return previous;
        }

        return tile;
      });
    };

    const handlePointerLeave = (): void => {
      setHoveredTile(null);
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
