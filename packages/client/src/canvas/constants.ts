// @module: canvas
// @tags: grid, constants

export const TILE_WIDTH = 75;
export const TILE_HEIGHT = 90;
export const ROW_STEP = TILE_HEIGHT / 2;

export const EVEN_ROW_COLUMNS = 10;
export const ODD_ROW_COLUMNS = 11;

export const GRID_HEIGHT = 495;
export const GRID_TOP_PADDING = 50;
export const GRID_BOTTOM_PADDING = 0;
export const GRID_SIDE_PADDING = 25;
export const GRID_LEFT_PADDING = GRID_SIDE_PADDING;
export const GRID_RIGHT_PADDING = GRID_SIDE_PADDING;

const MAX_ROW_COLUMNS = Math.max(EVEN_ROW_COLUMNS, ODD_ROW_COLUMNS);
const FIELD_WIDTH = MAX_ROW_COLUMNS * TILE_WIDTH;

export const CANVAS_WIDTH = FIELD_WIDTH + GRID_LEFT_PADDING + GRID_RIGHT_PADDING;
export const CANVAS_HEIGHT = GRID_TOP_PADDING + GRID_HEIGHT + GRID_BOTTOM_PADDING;

if (GRID_BOTTOM_PADDING < 0) {
  throw new Error(
    `Canvas height (${CANVAS_HEIGHT}) is too small for the configured grid. ` +
      `Increase CANVAS_HEIGHT so GRID_BOTTOM_PADDING remains non-negative.`
  );
}

export const ROW_COUNT = Math.floor((GRID_HEIGHT - TILE_HEIGHT) / ROW_STEP) + 1;
