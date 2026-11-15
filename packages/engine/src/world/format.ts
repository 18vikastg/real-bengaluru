/**
 * On-disk chunk format produced by tools/osm/bake.ts and consumed by the
 * chunk worker. All coordinates are integer decimetres relative to the
 * chunk's minimum corner, which keeps the JSON small and gzip-friendly.
 */
export const WORLD_FORMAT_VERSION = 1;
export const DM = 0.1;

export const BUILDING_COMMERCIAL = 1;
export const BUILDING_TANK = 2;

export const ROAD_ELEVATED = 1;
export const ROAD_MARKINGS = 2;
export const ROAD_FOOTPATH = 4;
/** Elevated rail viaduct rather than a road. */
export const ROAD_RAIL = 8;

export const AREA_GREEN = 0;
export const AREA_WATER = 1;
export const AREA_PITCH = 2;

/** [heightDm, wallColour, roofColour, flags, shopColour, x0, z0, x1, z1, ...] */
export type BuildingRecord = number[];
/** [widthDm, flags, x0, y0, z0, x1, y1, z1, ...] */
export type RoadRecord = number[];
/** [kind, x0, z0, x1, z1, ...] */
export type AreaRecord = number[];

export interface ChunkData {
  v: number;
  /** Chunk grid coordinates. */
  cx: number;
  cz: number;
  b: BuildingRecord[];
  r: RoadRecord[];
  a: AreaRecord[];
  /** Flat [x, z, heightDm, radiusDm, colour] per tree. */
  t: number[];
}

export interface WorldPlace {
  name: string;
  kind: string;
  x: number;
  z: number;
}

export interface WorldIndex {
  v: number;
  chunkSize: number;
  origin: { lat: number; lon: number };
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  /** Keys ("cx,cz") of every chunk that has a file. */
  chunks: string[];
  /** Areas too large for one chunk (lakes, big parks), in absolute decimetres. */
  globalAreas: AreaRecord[];
  places: WorldPlace[];
  spawn: { x: number; z: number };
  /** Content anchors snapped to walkable or drivable ground, by id. */
  anchors?: Record<string, { x: number; z: number }>;
  attribution: string;
  stats: Record<string, number>;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function chunkCoord(value: number, chunkSize: number): number {
  return Math.floor(value / chunkSize);
}

/**
 * Chunk keys whose centres lie within `radius` of (x, z), nearest first,
 * limited to chunks that exist.
 */
export function chunksInRadius(
  x: number,
  z: number,
  radius: number,
  chunkSize: number,
  exists: (key: string) => boolean,
): string[] {
  const found: { key: string; d: number }[] = [];
  const minCx = chunkCoord(x - radius, chunkSize);
  const maxCx = chunkCoord(x + radius, chunkSize);
  const minCz = chunkCoord(z - radius, chunkSize);
  const maxCz = chunkCoord(z + radius, chunkSize);
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const d = Math.hypot((cx + 0.5) * chunkSize - x, (cz + 0.5) * chunkSize - z);
      if (d > radius) continue;
      const key = chunkKey(cx, cz);
      if (exists(key)) found.push({ key, d });
    }
  }
  found.sort((a, b) => a.d - b.d);
  return found.map((entry) => entry.key);
}
