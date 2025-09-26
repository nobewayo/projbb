export interface UserRecord {
  id: string;
  username: string;
  roles: string[];
  passwordHash: string;
}

export interface PublicUser {
  id: string;
  username: string;
  roles: string[];
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  roles: string[];
}

export interface RoomSnapshotOccupant {
  id: string;
  username: string;
  roles: string[];
  position: { x: number; y: number };
}

export interface RoomSnapshot {
  id: string;
  name: string;
  roomSeq: number;
  occupants: RoomSnapshotOccupant[];
  tiles: Array<{
    x: number;
    y: number;
    locked: boolean;
    noPickup: boolean;
  }>;
  items: Array<{
    id: string;
    name: string;
    description: string;
    tileX: number;
    tileY: number;
    textureKey: string;
  }>;
  adminState: {
    affordances: {
      gridVisible: boolean;
      showHoverWhenGridHidden: boolean;
      moveAnimationsEnabled: boolean;
    };
    lastLatencyTrace: {
      traceId: string;
      requestedAt: string;
      requestedBy: string;
    } | null;
  };
}
