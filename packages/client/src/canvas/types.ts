export interface GridTile {
  key: string;
  gridX: number;
  gridY: number;
  screenX: number;
  screenY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface GridRowMetadata {
  index: number;
  columns: number;
  offsetX: number;
}

export interface GridDefinition {
  originX: number;
  originY: number;
  canvasWidth: number;
  canvasHeight: number;
  maxRowSpan: number;
  tiles: GridTile[];
  tileMap: Map<string, GridTile>;
  rows: GridRowMetadata[];
  rowCount: number;
  gridRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
}
