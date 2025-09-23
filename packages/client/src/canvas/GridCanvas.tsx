import { useEffect, useMemo, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH, GRID_HEIGHT } from './constants';
import { buildGridDefinition, findTileAtPoint } from './geometry';
import type { GridDefinition, GridTile } from './types';

interface PointerPosition {
  x: number;
  y: number;
}

const backgroundGradientStops: Array<[number, string]> = [
  [0, 'rgba(9, 16, 27, 0.95)'],
  [0.35, 'rgba(12, 22, 35, 0.95)'],
  [1, 'rgba(6, 10, 18, 0.98)'],
];

const evenRowFill = '#142033';
const oddRowFill = '#101a29';
const tileStroke = 'rgba(42, 64, 92, 0.9)';
const tileShadow = 'rgba(0, 0, 0, 0.2)';
const hoveredFill = '#245fba';
const hoveredStroke = '#7ad1ff';
const centerDot = '#5ec9ff';
const hoveredCenterDot = '#e8f6ff';

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

const drawBackground = (context: CanvasRenderingContext2D, grid: GridDefinition): void => {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const gradient = context.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (const [stop, color] of backgroundGradientStops) {
    gradient.addColorStop(stop, color);
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.fillStyle = 'rgba(10, 18, 30, 0.88)';
  context.fillRect(grid.originX, grid.originY, grid.maxRowSpan, GRID_HEIGHT);
};

const drawTile = (
  context: CanvasRenderingContext2D,
  tile: GridTile,
  options: { hovered: boolean },
): void => {
  const centerX = tile.centerX;
  const centerY = tile.centerY;

  context.beginPath();
  context.moveTo(centerX, tile.screenY);
  context.lineTo(tile.screenX + tile.width, centerY);
  context.lineTo(centerX, tile.screenY + tile.height);
  context.lineTo(tile.screenX, centerY);
  context.closePath();

  context.shadowColor = tileShadow;
  context.shadowBlur = options.hovered ? 16 : 8;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = options.hovered ? 4 : 2;

  context.fillStyle = options.hovered
    ? hoveredFill
    : tile.gridY % 2 === 0
      ? evenRowFill
      : oddRowFill;
  context.fill();

  context.shadowColor = 'transparent';
  context.lineWidth = options.hovered ? 2 : 1;
  context.strokeStyle = options.hovered ? hoveredStroke : tileStroke;
  context.stroke();

  context.beginPath();
  context.fillStyle = options.hovered ? hoveredCenterDot : centerDot;
  context.arc(centerX, centerY, options.hovered ? 3 : 2, 0, Math.PI * 2);
  context.fill();
};

const drawOriginMarker = (context: CanvasRenderingContext2D, grid: GridDefinition): void => {
  const rightEdge = grid.originX + grid.maxRowSpan;
  context.save();
  context.strokeStyle = 'rgba(122, 209, 255, 0.4)';
  context.lineWidth = 1;
  context.setLineDash([4, 6]);
  const markerTop = Math.max(0, grid.originY - 12);
  const markerBottom = Math.min(grid.canvasHeight, grid.originY + GRID_HEIGHT + 12);
  context.beginPath();
  context.moveTo(rightEdge, markerTop);
  context.lineTo(rightEdge, markerBottom);
  context.stroke();
  context.restore();
};

const renderGrid = (
  context: CanvasRenderingContext2D,
  grid: GridDefinition,
  hoveredTile: GridTile | null,
): void => {
  drawBackground(context, grid);

  for (const tile of grid.tiles) {
    drawTile(context, tile, { hovered: hoveredTile?.key === tile.key });
  }

  drawOriginMarker(context, grid);
};

const formatCoordinate = (value: number): string => value.toFixed(0);

const GridCanvas = (): JSX.Element => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grid = useMemo(() => buildGridDefinition(), []);
  const [hoveredTile, setHoveredTile] = useState<GridTile | null>(null);
  const [pointer, setPointer] = useState<PointerPosition | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = prepareContext(canvas);
    if (!context) {
      return;
    }

    renderGrid(context, grid, hoveredTile);
    context.restore();
  }, [grid, hoveredTile]);

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

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [grid]);

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
