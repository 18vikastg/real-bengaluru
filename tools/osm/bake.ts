/**
 * Bakes the cached OpenStreetMap extract into streamable world chunks.
 *
 *   pnpm world:fetch   # once, downloads tools/osm/cache/
 *   pnpm world:bake    # writes apps/game/public/world/
 *
 * Everything here is deterministic: the same extract always produces the
 * same world. Data © OpenStreetMap contributors, ODbL.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  AreaRecord,
  ChunkData,
  WorldIndex,
  WorldPlace,
} from '../../packages/engine/src/index';
import {
  AREA_GREEN,
  AREA_PITCH,
  AREA_WATER,
  BUILDING_COMMERCIAL,
  BUILDING_TANK,
  ROAD_ELEVATED,
  ROAD_FOOTPATH,
  ROAD_MARKINGS,
  ROAD_RAIL,
  SHOP_COLORS,
  ROOF_COLORS,
  WALL_COLORS,
  TREE_COLORS,
  WORLD_FORMAT_VERSION,
  centroid,
  chunkCoord,
  chunkKey,
  createRng,
  pointInPolygon,
  projectToLocal,
  signedArea,
} from '../../packages/engine/src/index';
import { ANCHORS } from '../../packages/content/src/city/anchors';
import { BBOX, CACHE_DIR, CHUNK_SIZE, ORIGIN, OUTPUT_DIR, SKETCH_DIR } from './config.mjs';

type Tags = Record<string, string>;
interface OsmNode {
  x: number;
  z: number;
  tags?: Tags;
}
interface OsmWay {
  id: number;
  nodes: number[];
  tags: Tags;
}
interface OsmRelation {
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags: Tags;
}
interface RawElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: { type: string; ref: number; role: string }[];
  tags?: Tags;
}

const FLOOR = 3.1;
const SHOP_FLOOR = 3.4;
const RAMP_SLOPE = 0.06;
const MAX_SEGMENT = 25;
const dm = (metres: number) => Math.round(metres * 10);

// ---------------------------------------------------------------- load

const nodes = new Map<number, OsmNode>();
const ways = new Map<number, OsmWay>();
const relations = new Map<number, OsmRelation>();

/** `--sketch` bakes the hand-drawn placeholder extract instead of the real one. */
const SKETCH = process.argv.includes('--sketch');
const cachePath = fileURLToPath(SKETCH ? SKETCH_DIR : CACHE_DIR);
const tiles = readdirSync(cachePath).filter((name) => name.startsWith('tile_'));
if (tiles.length === 0) {
  throw new Error(
    `No tiles in ${cachePath}. Run \`pnpm world:fetch\` (or \`pnpm world:sketch\`) first.`,
  );
}
for (const name of tiles.sort()) {
  const data = JSON.parse(readFileSync(cachePath + name, 'utf8')) as { elements: RawElement[] };
  for (const element of data.elements) {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      const local = projectToLocal({ lat: element.lat, lon: element.lon }, ORIGIN);
      nodes.set(element.id, element.tags ? { ...local, tags: element.tags } : local);
    } else if (element.type === 'way' && element.nodes) {
      ways.set(element.id, { id: element.id, nodes: element.nodes, tags: element.tags ?? {} });
    } else if (element.type === 'relation' && element.members) {
      relations.set(element.id, {
        id: element.id,
        members: element.members,
        tags: element.tags ?? {},
      });
    }
  }
}

const min = projectToLocal({ lat: BBOX.north, lon: BBOX.west }, ORIGIN);
const max = projectToLocal({ lat: BBOX.south, lon: BBOX.east }, ORIGIN);
const bounds = { minX: min.x, minZ: min.z, maxX: max.x, maxZ: max.z };
const inBounds = (x: number, z: number, margin = 0) =>
  x >= bounds.minX - margin &&
  x <= bounds.maxX + margin &&
  z >= bounds.minZ - margin &&
  z <= bounds.maxZ + margin;

// ---------------------------------------------------------------- chunks

const chunks = new Map<string, ChunkData>();
function chunkAt(x: number, z: number): ChunkData {
  const cx = chunkCoord(x, CHUNK_SIZE);
  const cz = chunkCoord(z, CHUNK_SIZE);
  const key = chunkKey(cx, cz);
  let chunk = chunks.get(key);
  if (!chunk) {
    chunk = { v: WORLD_FORMAT_VERSION, cx, cz, b: [], r: [], a: [], t: [] };
    chunks.set(key, chunk);
  }
  return chunk;
}
const stats: Record<string, number> = {
  buildings: 0,
  roadRuns: 0,
  areas: 0,
  trees: 0,
  elevatedRuns: 0,
};

/** Ring of a closed way as flat [x, z, ...] in metres, without the closing point. */
function ringOf(nodeIds: readonly number[]): number[] | null {
  const ring: number[] = [];
  const last = nodeIds[0] === nodeIds[nodeIds.length - 1] ? nodeIds.length - 1 : nodeIds.length;
  for (let i = 0; i < last; i++) {
    const node = nodes.get(nodeIds[i] as number);
    if (!node) return null;
    ring.push(node.x, node.z);
  }
  return ring.length >= 6 ? ring : null;
}

// ---------------------------------------------------------------- spatial grids

const CELL = 50;
const cellKey = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
const buildingGrid = new Map<string, number[][]>();
interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
}
const roadGrid = new Map<string, Segment[]>();

function addToGrid<T>(
  grid: Map<string, T[]>,
  item: T,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): void {
  for (
    let gx = Math.floor(Math.min(x0, x1) / CELL);
    gx <= Math.floor(Math.max(x0, x1) / CELL);
    gx++
  ) {
    for (
      let gz = Math.floor(Math.min(z0, z1) / CELL);
      gz <= Math.floor(Math.max(z0, z1) / CELL);
      gz++
    ) {
      const key = `${gx},${gz}`;
      const list = grid.get(key);
      if (list) list.push(item);
      else grid.set(key, [item]);
    }
  }
}

function insideBuilding(x: number, z: number): boolean {
  return (buildingGrid.get(cellKey(x, z)) ?? []).some((ring) => pointInPolygon(x, z, ring));
}

function onRoad(x: number, z: number, clearance: number): boolean {
  for (const s of roadGrid.get(cellKey(x, z)) ?? []) {
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const t = Math.min(
      1,
      Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)),
    );
    if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) < s.half + clearance) return true;
  }
  return false;
}

// ---------------------------------------------------------------- buildings

const COMMERCIAL_KINDS = new Set([
  'commercial',
  'retail',
  'office',
  'hotel',
  'supermarket',
  'kiosk',
]);
const places: (WorldPlace & { weight: number })[] = [];

for (const way of ways.values()) {
  if (!way.tags.building) continue;
  const ring = ringOf(way.nodes);
  if (!ring) continue;
  const area = Math.abs(signedArea(ring));
  const centre = centroid(ring);
  if (area < 8 || !inBounds(centre.x, centre.z)) continue;

  const rng = createRng(way.id);
  const taggedLevels = Number.parseFloat(way.tags['building:levels'] ?? '');
  const taggedHeight = Number.parseFloat(way.tags.height ?? '');
  let floors: number;
  if (taggedLevels > 0) floors = Math.round(taggedLevels);
  else if (taggedHeight > 0) floors = Math.round(taggedHeight / FLOOR);
  else if (area < 80) floors = 1 + Math.floor(rng() * 3);
  else if (area < 400) floors = 2 + Math.floor(rng() * 4);
  else floors = 3 + Math.floor(rng() * 5);
  floors = Math.min(40, Math.max(1, floors));

  const commercial =
    floors >= 2 &&
    (COMMERCIAL_KINDS.has(way.tags.building) ||
      'shop' in way.tags ||
      'amenity' in way.tags ||
      rng() < 0.2);
  const height = commercial ? SHOP_FLOOR + (floors - 1) * FLOOR : floors * FLOOR;
  let flags = commercial ? BUILDING_COMMERCIAL : 0;
  if (area > 50 && rng() < 0.6 && pointInPolygon(centre.x, centre.z, ring)) flags |= BUILDING_TANK;

  const chunk = chunkAt(centre.x, centre.z);
  const record = [
    dm(height),
    Math.floor(rng() * WALL_COLORS.length),
    Math.floor(rng() * ROOF_COLORS.length),
    flags,
    Math.floor(rng() * SHOP_COLORS.length),
  ];
  for (let i = 0; i < ring.length; i += 2) {
    record.push(
      dm((ring[i] as number) - chunk.cx * CHUNK_SIZE),
      dm((ring[i + 1] as number) - chunk.cz * CHUNK_SIZE),
    );
  }
  chunk.b.push(record);
  stats.buildings = (stats.buildings ?? 0) + 1;

  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    x0 = Math.min(x0, ring[i] as number);
    x1 = Math.max(x1, ring[i] as number);
    z0 = Math.min(z0, ring[i + 1] as number);
    z1 = Math.max(z1, ring[i + 1] as number);
  }
  addToGrid(buildingGrid, ring, x0, z0, x1, z1);
  if (way.tags.name && area > 1200) {
    places.push({
      name: way.tags.name,
      kind: 'building',
      x: Math.round(centre.x),
      z: Math.round(centre.z),
      weight: area,
    });
  }
}

// ---------------------------------------------------------------- roads

interface RoadClass {
  width: number;
  major: boolean;
  footpath: boolean;
  trees: boolean;
}
const ROAD_CLASSES: Record<string, RoadClass> = {
  motorway: { width: 14, major: true, footpath: false, trees: false },
  trunk: { width: 14, major: true, footpath: true, trees: false },
  primary: { width: 12, major: true, footpath: true, trees: false },
  secondary: { width: 10, major: true, footpath: true, trees: true },
  tertiary: { width: 8, major: true, footpath: true, trees: true },
  unclassified: { width: 6, major: false, footpath: true, trees: true },
  residential: { width: 6, major: false, footpath: true, trees: true },
  living_street: { width: 5, major: false, footpath: false, trees: true },
  service: { width: 3.6, major: false, footpath: false, trees: false },
  busway: { width: 7, major: false, footpath: false, trees: false },
};
function roadClass(tags: Tags): RoadClass | null {
  const kind = tags.highway ?? '';
  const base = ROAD_CLASSES[kind.replace(/_link$/, '')];
  if (!base) return null;
  const link = kind.endsWith('_link');
  const oneway = tags.oneway === 'yes';
  const lanes = Number.parseFloat(tags.lanes ?? '');
  let width = base.width;
  if (lanes > 0) width = Math.min(22, lanes * 3.3 + 1);
  else if (link) width = 6.5;
  else if (oneway && base.major) width = base.width * 0.68;
  return { ...base, width, major: base.major && !link };
}

interface Road {
  way: OsmWay;
  cls: RoadClass;
  rail: boolean;
}
const roads: Road[] = [];
for (const way of ways.values()) {
  const cls = roadClass(way.tags);
  if (cls) roads.push({ way, cls, rail: false });
  else if (way.tags.railway === 'subway' && way.tags.bridge) {
    roads.push({
      way,
      cls: { width: 8.5, major: false, footpath: false, trees: false },
      rail: true,
    });
  }
}

// Elevation. Long bridge chains become flyovers; short ones (culverts over drains) stay flat.
const nodeHeight = new Map<number, number>();
{
  const parent = new Map<number, number>();
  const find = (id: number): number => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root)
      root = parent.get(root) as number;
    parent.set(id, root);
    return root;
  };
  const bridges = roads.filter(
    (road) => !road.rail && road.way.tags.bridge && road.way.tags.bridge !== 'no',
  );
  const byNode = new Map<number, number>();
  for (const { way } of bridges) {
    parent.set(way.id, way.id);
    for (const id of way.nodes) {
      const other = byNode.get(id);
      if (other === undefined) byNode.set(id, way.id);
      else parent.set(find(way.id), find(other));
    }
  }
  const wayLength = (way: OsmWay) => {
    let total = 0;
    for (let i = 0; i + 1 < way.nodes.length; i++) {
      const a = nodes.get(way.nodes[i] as number);
      const b = nodes.get(way.nodes[i + 1] as number);
      if (a && b) total += Math.hypot(b.x - a.x, b.z - a.z);
    }
    return total;
  };
  const groupLength = new Map<number, number>();
  for (const { way } of bridges) {
    const root = find(way.id);
    groupLength.set(root, (groupLength.get(root) ?? 0) + wayLength(way));
  }
  const queue: number[] = [];
  for (const { way } of bridges) {
    if ((groupLength.get(find(way.id)) ?? 0) < 100) continue;
    const layer = Math.min(3, Math.max(1, Number.parseInt(way.tags.layer ?? '1', 10) || 1));
    for (const id of way.nodes) {
      const height = 6.5 * layer;
      if (height > (nodeHeight.get(id) ?? 0)) {
        nodeHeight.set(id, height);
        queue.push(id);
      }
    }
  }
  // Ramps: let height fall away from the flyover at a fixed gradient along connected roads.
  const neighbours = new Map<number, { to: number; length: number }[]>();
  for (const { way, rail } of roads) {
    if (rail) continue;
    for (let i = 0; i + 1 < way.nodes.length; i++) {
      const aId = way.nodes[i] as number;
      const bId = way.nodes[i + 1] as number;
      const a = nodes.get(aId);
      const b = nodes.get(bId);
      if (!a || !b) continue;
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      (neighbours.get(aId) ?? neighbours.set(aId, []).get(aId))?.push({ to: bId, length });
      (neighbours.get(bId) ?? neighbours.set(bId, []).get(bId))?.push({ to: aId, length });
    }
  }
  while (queue.length > 0) {
    const id = queue.pop() as number;
    const height = nodeHeight.get(id) ?? 0;
    for (const { to, length } of neighbours.get(id) ?? []) {
      const candidate = height - RAMP_SLOPE * length;
      if (candidate > 0.05 && candidate > (nodeHeight.get(to) ?? 0) + 0.01) {
        nodeHeight.set(to, candidate);
        queue.push(to);
      }
    }
  }
}

interface RoadLine {
  cls: RoadClass;
  rail: boolean;
  /** Flat [x, y, z, ...] in metres. */
  points: number[];
}
const roadLines: RoadLine[] = [];
for (const { way, cls, rail } of roads) {
  const railHeight = rail ? (Number.parseInt(way.tags.layer ?? '2', 10) >= 3 ? 17 : 12) : 0;
  const points: number[] = [];
  let previous: { x: number; y: number; z: number } | null = null;
  for (const id of way.nodes) {
    const node = nodes.get(id);
    if (!node) continue;
    const current = { x: node.x, y: rail ? railHeight : (nodeHeight.get(id) ?? 0), z: node.z };
    if (previous) {
      // Subdivide long segments so ramps and chunk borders stay smooth.
      const length = Math.hypot(current.x - previous.x, current.z - previous.z);
      const pieces = Math.max(1, Math.ceil(length / MAX_SEGMENT));
      for (let p = 1; p < pieces; p++) {
        const t = p / pieces;
        points.push(
          previous.x + (current.x - previous.x) * t,
          previous.y + (current.y - previous.y) * t,
          previous.z + (current.z - previous.z) * t,
        );
      }
    }
    points.push(current.x, current.y, current.z);
    previous = current;
  }
  if (points.length >= 6) roadLines.push({ cls, rail, points });
}

for (const { cls, rail, points } of roadLines) {
  const count = points.length / 3;
  let run: number[] = [];
  let runChunk: ChunkData | null = null;
  const flush = () => {
    if (!runChunk || run.length < 6) return;
    let elevated = false;
    for (let i = 1; i < run.length; i += 3) if ((run[i] as number) > 0.5) elevated = true;
    let flags = 0;
    if (rail) flags |= ROAD_RAIL | ROAD_ELEVATED;
    else {
      if (elevated) flags |= ROAD_ELEVATED;
      if (cls.major) flags |= ROAD_MARKINGS;
      if (cls.footpath && !elevated) flags |= ROAD_FOOTPATH;
    }
    const record = [dm(cls.width), flags];
    for (let i = 0; i < run.length; i += 3) {
      record.push(
        dm((run[i] as number) - runChunk.cx * CHUNK_SIZE),
        dm(run[i + 1] as number),
        dm((run[i + 2] as number) - runChunk.cz * CHUNK_SIZE),
      );
    }
    runChunk.r.push(record);
    stats.roadRuns = (stats.roadRuns ?? 0) + 1;
    if (elevated || rail) stats.elevatedRuns = (stats.elevatedRuns ?? 0) + 1;
  };
  for (let i = 0; i + 1 < count; i++) {
    const ax = points[i * 3] as number;
    const ay = points[i * 3 + 1] as number;
    const az = points[i * 3 + 2] as number;
    const bx = points[(i + 1) * 3] as number;
    const by = points[(i + 1) * 3 + 1] as number;
    const bz = points[(i + 1) * 3 + 2] as number;
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    if (!inBounds(mx, mz, 60)) {
      flush();
      run = [];
      runChunk = null;
      continue;
    }
    const chunk = chunkAt(mx, mz);
    if (chunk !== runChunk) {
      flush();
      run = [ax, ay, az];
      runChunk = chunk;
    }
    run.push(bx, by, bz);
    if (!rail && ay < 0.5 && by < 0.5)
      addToGrid(roadGrid, { ax, az, bx, bz, half: cls.width / 2 }, ax, az, bx, bz);
  }
  flush();
}

// ---------------------------------------------------------------- areas

function areaKind(tags: Tags): number | null {
  if (tags.natural === 'water') return AREA_WATER;
  if (tags.leisure === 'pitch') return AREA_PITCH;
  if (tags.leisure && ['park', 'garden', 'playground'].includes(tags.leisure)) return AREA_GREEN;
  if (
    tags.landuse &&
    ['grass', 'recreation_ground', 'forest', 'village_green'].includes(tags.landuse)
  )
    return AREA_GREEN;
  if (tags.natural && ['wood', 'scrub', 'grassland'].includes(tags.natural)) return AREA_GREEN;
  return null;
}

/** Stitches the outer member ways of a multipolygon into closed rings. */
function outerRings(relation: OsmRelation): number[][] {
  const pieces = relation.members
    .filter((member) => member.type === 'way' && member.role !== 'inner')
    .map((member) => ways.get(member.ref)?.nodes.slice())
    .filter((piece): piece is number[] => piece !== undefined && piece.length >= 2);
  const rings: number[][] = [];
  while (pieces.length > 0) {
    const ring = pieces.pop() as number[];
    let extended = true;
    while (ring[0] !== ring[ring.length - 1] && extended) {
      extended = false;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i] as number[];
        const tail = ring[ring.length - 1];
        if (piece[0] === tail) ring.push(...piece.slice(1));
        else if (piece[piece.length - 1] === tail) ring.push(...piece.reverse().slice(1));
        else continue;
        pieces.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (ring[0] === ring[ring.length - 1] && ring.length >= 4) rings.push(ring);
  }
  return rings;
}

const globalAreas: AreaRecord[] = [];
const greens: { ring: number[]; area: number; seed: number }[] = [];
function addAreaRing(kind: number, nodeIds: number[], tags: Tags, seed: number): void {
  const ring = ringOf(nodeIds);
  if (!ring) return;
  const area = Math.abs(signedArea(ring));
  const centre = centroid(ring);
  if (area < 30 || !inBounds(centre.x, centre.z, 400)) return;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    x0 = Math.min(x0, ring[i] as number);
    x1 = Math.max(x1, ring[i] as number);
    z0 = Math.min(z0, ring[i + 1] as number);
    z1 = Math.max(z1, ring[i + 1] as number);
  }
  if (Math.max(x1 - x0, z1 - z0) > 300 || !inBounds(centre.x, centre.z)) {
    globalAreas.push([kind, ...ring.map(dm)]);
  } else {
    const chunk = chunkAt(centre.x, centre.z);
    const record = [kind];
    for (let i = 0; i < ring.length; i += 2) {
      record.push(
        dm((ring[i] as number) - chunk.cx * CHUNK_SIZE),
        dm((ring[i + 1] as number) - chunk.cz * CHUNK_SIZE),
      );
    }
    chunk.a.push(record);
  }
  stats.areas = (stats.areas ?? 0) + 1;
  if (kind === AREA_GREEN) greens.push({ ring, area, seed });
  if (tags.name && area > 1500) {
    places.push({
      name: tags.name,
      kind: kind === AREA_WATER ? 'water' : 'park',
      x: Math.round(centre.x),
      z: Math.round(centre.z),
      weight: area,
    });
  }
}
for (const way of ways.values()) {
  if (way.tags.building) continue;
  const kind = areaKind(way.tags);
  if (kind !== null && way.nodes[0] === way.nodes[way.nodes.length - 1])
    addAreaRing(kind, way.nodes, way.tags, way.id);
}
for (const relation of relations.values()) {
  if (relation.tags.type !== 'multipolygon') continue;
  const kind = areaKind(relation.tags);
  if (kind === null) continue;
  for (const ring of outerRings(relation)) addAreaRing(kind, ring, relation.tags, relation.id);
}

// ---------------------------------------------------------------- trees

function addTree(x: number, z: number, rng: () => number): void {
  if (!inBounds(x, z)) return;
  const chunk = chunkAt(x, z);
  const colour =
    rng() < 0.08 ? TREE_COLORS.length - 1 : Math.floor(rng() * (TREE_COLORS.length - 1));
  chunk.t.push(
    dm(x - chunk.cx * CHUNK_SIZE),
    dm(z - chunk.cz * CHUNK_SIZE),
    dm(4.5 + rng() * 3.5),
    dm(2.2 + rng() * 2),
    colour,
  );
  stats.trees = (stats.trees ?? 0) + 1;
}

{
  const rng = createRng(20261113);
  // Avenue trees along the kerb of streets, alternating sides.
  for (const { cls, rail, points } of roadLines) {
    if (rail || !cls.trees) continue;
    let next = 6 + rng() * 14;
    let side = rng() < 0.5 ? 1 : -1;
    const count = points.length / 3;
    for (let i = 0; i + 1 < count; i++) {
      if ((points[i * 3 + 1] as number) > 0.3) continue;
      const ax = points[i * 3] as number;
      const az = points[i * 3 + 2] as number;
      const dx = (points[(i + 1) * 3] as number) - ax;
      const dz = (points[(i + 1) * 3 + 2] as number) - az;
      const length = Math.hypot(dx, dz);
      if (length < 1e-3) continue;
      while (next < length) {
        const offset = (cls.width / 2 + 1.1) * side;
        const x = ax + (dx / length) * next + (-dz / length) * offset;
        const z = az + (dz / length) * next + (dx / length) * offset;
        if (!insideBuilding(x, z) && !onRoad(x, z, 0.5)) addTree(x, z, rng);
        side = -side;
        next += 16 + rng() * 16;
      }
      next -= length;
    }
  }
  // Scatter trees through parks and green patches.
  for (const { ring, area, seed } of greens) {
    const parkRng = createRng(seed);
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < ring.length; i += 2) {
      x0 = Math.min(x0, ring[i] as number);
      x1 = Math.max(x1, ring[i] as number);
      z0 = Math.min(z0, ring[i + 1] as number);
      z1 = Math.max(z1, ring[i + 1] as number);
    }
    const wanted = Math.min(140, Math.floor(area / 130));
    for (let attempt = 0, placed = 0; attempt < wanted * 4 && placed < wanted; attempt++) {
      const x = x0 + parkRng() * (x1 - x0);
      const z = z0 + parkRng() * (z1 - z0);
      if (!pointInPolygon(x, z, ring) || insideBuilding(x, z) || onRoad(x, z, 1)) continue;
      addTree(x, z, parkRng);
      placed++;
    }
  }
  // Individually mapped trees.
  for (const node of nodes.values()) {
    if (node.tags?.natural === 'tree' && !insideBuilding(node.x, node.z))
      addTree(node.x, node.z, rng);
  }
}

// ---------------------------------------------------------------- anchors

/**
 * Snaps each content anchor to somewhere a person (open ground beside a road)
 * or a vehicle (road surface) can actually be, searching outwards in rings.
 */
const anchors: Record<string, { x: number; z: number }> = {};
for (const anchor of ANCHORS) {
  const wanted = projectToLocal({ lat: anchor.lat, lon: anchor.lon }, ORIGIN);
  const fits = (x: number, z: number) =>
    inBounds(x, z, -20) &&
    !insideBuilding(x, z) &&
    (anchor.kind === 'road' ? onRoad(x, z, -1) : !onRoad(x, z, 0.4) && onRoad(x, z, 4));
  let found: { x: number; z: number } | null = null;
  for (let radius = 0; radius <= 150 && !found; radius += 1.5) {
    const steps = radius === 0 ? 1 : Math.max(8, Math.round(radius * 2));
    for (let i = 0; i < steps && !found; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = wanted.x + Math.cos(angle) * radius;
      const z = wanted.z + Math.sin(angle) * radius;
      if (fits(x, z)) found = { x, z };
    }
  }
  if (!found) console.warn(`Anchor ${anchor.id}: no clear spot nearby, using the raw position.`);
  const spot = found ?? wanted;
  anchors[anchor.id] = { x: Math.round(spot.x * 10) / 10, z: Math.round(spot.z * 10) / 10 };
}

// ---------------------------------------------------------------- write

const outputPath = fileURLToPath(OUTPUT_DIR);
rmSync(outputPath, { recursive: true, force: true });
mkdirSync(outputPath, { recursive: true });

let bytes = 0;
const keys: string[] = [];
for (const [key, chunk] of [...chunks.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (chunk.b.length + chunk.r.length + chunk.a.length + chunk.t.length === 0) continue;
  const json = JSON.stringify(chunk);
  writeFileSync(`${outputPath}${chunk.cx}_${chunk.cz}.json`, json);
  bytes += json.length;
  keys.push(key);
}

places.sort((a, b) => b.weight - a.weight);
const seenNames = new Set<string>();
const topPlaces: WorldPlace[] = [];
for (const { name, kind, x, z } of places) {
  if (seenNames.has(name) || topPlaces.length >= 80) continue;
  seenNames.add(name);
  topPlaces.push({ name, kind, x, z });
}

const index: WorldIndex = {
  v: WORLD_FORMAT_VERSION,
  chunkSize: CHUNK_SIZE,
  origin: ORIGIN,
  bounds: {
    minX: Math.round(bounds.minX),
    minZ: Math.round(bounds.minZ),
    maxX: Math.round(bounds.maxX),
    maxZ: Math.round(bounds.maxZ),
  },
  chunks: keys,
  globalAreas,
  places: topPlaces,
  spawn: anchors.majestic_bus ?? { x: 0, z: 0 },
  anchors,
  attribution: SKETCH ? 'Placeholder street sketch' : '© OpenStreetMap contributors',
  stats: SKETCH ? { ...stats, sketch: 1 } : stats,
};
const indexJson = JSON.stringify(index);
writeFileSync(`${outputPath}index.json`, indexJson);
bytes += indexJson.length;

console.log(`Baked ${keys.length} chunks, ${(bytes / 1024 / 1024).toFixed(2)} MB uncompressed.`);
console.log(stats);
