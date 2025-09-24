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
}
