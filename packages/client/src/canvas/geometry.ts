import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  EVEN_ROW_COLUMNS,
  GRID_HEIGHT,
  GRID_LEFT_PADDING,
  GRID_RIGHT_PADDING,
  GRID_TOP_PADDING,
  ODD_ROW_COLUMNS,
  ROW_COUNT,
  ROW_STEP,
  TILE_HEIGHT,
  TILE_WIDTH,
} from './constants';
import type { GridDefinition, GridRowMetadata, GridTile } from './types';

const createTileKey = (gridX: number, gridY: number): string => `${gridX},${gridY}`;

export const getColumnsForRow = (row: number): number =>
  row % 2 === 0 ? EVEN_ROW_COLUMNS : ODD_ROW_COLUMNS;

const getMaxColumns = (): number => Math.max(EVEN_ROW_COLUMNS, ODD_ROW_COLUMNS);

const getRowOffset = (row: number): number => {
  const columns = getColumnsForRow(row);
  return columns < getMaxColumns() ? TILE_WIDTH / 2 : 0;
};

const getRowRightSpan = (row: number): number => {
  const columns = getColumnsForRow(row);
  const offset = columns < getMaxColumns() ? TILE_WIDTH / 2 : 0;
  return columns * TILE_WIDTH + offset;
};

const computeMaxRowSpan = (rowCount: number): number => {
  let maxSpan = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const span = getRowRightSpan(row);
    if (span > maxSpan) {
      maxSpan = span;
    }
  }

  return maxSpan;
};

export const buildGridDefinition = (
  canvasWidth: number = CANVAS_WIDTH,
  canvasHeight: number = CANVAS_HEIGHT,
): GridDefinition => {
  const rowCount = ROW_COUNT;
  const maxRowSpan = computeMaxRowSpan(rowCount);
  const originX = Math.max(
    GRID_LEFT_PADDING,
    canvasWidth - GRID_RIGHT_PADDING - maxRowSpan,
  );
  const originY = GRID_TOP_PADDING;

  const tiles: GridTile[] = [];
  const tileMap = new Map<string, GridTile>();
  const rows: GridRowMetadata[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const columns = getColumnsForRow(row);
    const offsetX = originX + getRowOffset(row);
    const screenY = originY + row * ROW_STEP;

    rows.push({ index: row, columns, offsetX });

    for (let column = 0; column < columns; column += 1) {
      const screenX = offsetX + column * TILE_WIDTH;
      const tile: GridTile = {
        key: createTileKey(column, row),
        gridX: column,
        gridY: row,
        screenX,
        screenY,
        centerX: screenX + TILE_WIDTH / 2,
        centerY: screenY + TILE_HEIGHT / 2,
        width: TILE_WIDTH,
        height: TILE_HEIGHT,
      };

      tiles.push(tile);
      tileMap.set(tile.key, tile);
    }
  }

  const gridRect = {
    left: originX,
    top: originY,
    right: originX + maxRowSpan,
    bottom: originY + GRID_HEIGHT,
    width: maxRowSpan,
    height: GRID_HEIGHT,
  } as const;

  return {
    originX,
    originY,
    canvasWidth,
    canvasHeight,
    maxRowSpan,
    tiles,
    tileMap,
    rows,
    rowCount,
    gridRect,
  };
};

export const isPointInsideTile = (tile: GridTile, px: number, py: number): boolean => {
  const dx = (px - (tile.screenX + tile.width / 2)) / (tile.width / 2);
  const dy = (py - (tile.screenY + tile.height / 2)) / (tile.height / 2);

  return Math.abs(dx) + Math.abs(dy) <= 1;
};

export const findTileAtPoint = (
  grid: GridDefinition,
  px: number,
  py: number,
): GridTile | null => {
  const minY = grid.originY - TILE_HEIGHT / 2;
  const maxY = grid.gridRect.bottom + TILE_HEIGHT / 2;

  if (py < minY || py > maxY) {
    return null;
  }

  const approximateRow = Math.floor((py - grid.originY) / ROW_STEP);
  const candidateRows = new Set<number>([
    approximateRow - 1,
    approximateRow,
    approximateRow + 1,
  ]);

  for (const rowIndex of candidateRows) {
    if (rowIndex < 0 || rowIndex >= grid.rows.length) {
      continue;
    }

    const row = grid.rows[rowIndex];
    const approximateColumn = Math.floor((px - row.offsetX) / TILE_WIDTH);
    const candidateColumns = new Set<number>([
      approximateColumn - 1,
      approximateColumn,
      approximateColumn + 1,
    ]);

    for (const columnIndex of candidateColumns) {
      if (columnIndex < 0 || columnIndex >= row.columns) {
        continue;
      }

      const tile = grid.tileMap.get(createTileKey(columnIndex, row.index));
      if (tile && isPointInsideTile(tile, px, py)) {
        return tile;
      }
    }
  }

  return null;
};

export const toScreenPosition = (
  grid: GridDefinition,
  gridX: number,
  gridY: number,
): { x: number; y: number } => {
  const offsetX = grid.originX + getRowOffset(gridY);

  return {
    x: offsetX + gridX * TILE_WIDTH,
    y: grid.originY + gridY * ROW_STEP,
  };
};

export { createTileKey };
