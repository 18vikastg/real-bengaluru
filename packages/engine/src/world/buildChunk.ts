import earcut from 'earcut';
import type { AreaRecord, ChunkData } from './format';
import {
  AREA_PITCH,
  AREA_WATER,
  BUILDING_COMMERCIAL,
  BUILDING_TANK,
  DM,
  ROAD_ELEVATED,
  ROAD_FOOTPATH,
  ROAD_MARKINGS,
  ROAD_RAIL,
} from './format';
import type { MeshData, Rgb } from './meshBuilder';
import { MeshBuilder } from './meshBuilder';
import { COLOR, ROOF_COLORS, SHOP_COLORS, WALL_COLORS, hexToLinear } from './palette';
import { centroid, signedArea } from './polygon';

/** World size of one repeat of the window texture (a 4 x 4 grid of windows). */
export const WINDOW_TILE_U = 12;
export const WINDOW_TILE_V = 12.4;
export const SHOP_HEIGHT = 3.4;

const ROAD_LIFT = 0.14;
const FOOTPATH_LIFT = 0.06;
const FOOTPATH_EXTRA = 1.8;
const MARKING_LIFT = 0.2;
const DECK_DEPTH = 1.2;
const PARAPET_HEIGHT = 0.9;
const PILLAR_SPACING = 28;

export interface ChunkMeshes {
  /** Textured building walls (shadow casters). */
  walls: MeshData;
  /** Untextured shadow casters: roofs, shopfronts, flyover decks, pillars. */
  solid: MeshData;
  /** Flat, shadow-receiving surfaces: roads, footpaths, markings, parks, water. */
  ground: MeshData;
  /** [x, y, z, height, radius, colourIndex] per tree. */
  trees: Float32Array;
  /** [x, y, z] per rooftop water tank. */
  tanks: Float32Array;
}

const linear = (hex: string): Rgb => hexToLinear(hex);
const WALLS = WALL_COLORS.map(linear);
const ROOFS = ROOF_COLORS.map(linear);
const SHOPS = SHOP_COLORS.map(linear);
const C = {
  asphalt: linear(COLOR.asphalt),
  asphaltMinor: linear(COLOR.asphaltMinor),
  footpath: linear(COLOR.footpath),
  marking: linear(COLOR.marking),
  concrete: linear(COLOR.concrete),
  concreteDark: linear(COLOR.concreteDark),
  green: linear(COLOR.green),
  pitch: linear(COLOR.pitch),
  water: linear(COLOR.water),
  shutter: linear(COLOR.shutter),
  awning: linear(COLOR.awning),
};
const pick = <T>(list: readonly T[], index: number): T => list[index % list.length] as T;

function addBuilding(
  record: number[],
  walls: MeshBuilder,
  solid: MeshBuilder,
  tanks: number[],
): void {
  const height = (record[0] ?? 0) * DM;
  const wall = pick(WALLS, record[1] ?? 0);
  const roof = pick(ROOFS, record[2] ?? 0);
  const flags = record[3] ?? 0;
  const shop = pick(SHOPS, record[4] ?? 0);
  const ring: number[] = [];
  for (let i = 5; i < record.length; i++) ring.push((record[i] as number) * DM);
  const n = ring.length / 2;
  if (n < 3 || height <= 0) return;

  const sign = signedArea(ring) >= 0 ? 1 : -1;
  const commercial = (flags & BUILDING_COMMERCIAL) !== 0 && height > SHOP_HEIGHT + 2;
  const base = commercial ? SHOP_HEIGHT : 0;
  const vTop = (height - base) / WINDOW_TILE_V;
  let distance = Math.abs(((ring[0] as number) * 7.3 + (ring[1] as number) * 3.1) % WINDOW_TILE_U);

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = ring[i * 2] as number;
    const az = ring[i * 2 + 1] as number;
    const bx = ring[j * 2] as number;
    const bz = ring[j * 2 + 1] as number;
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;
    const nx = (sign * dz) / length;
    const nz = (-sign * dx) / length;
    const u0 = distance / WINDOW_TILE_U;
    const u1 = (distance + length) / WINDOW_TILE_U;
    distance += length;

    const w0 = walls.vertex(ax, base, az, nx, 0, nz, wall, u0, 0);
    const w1 = walls.vertex(bx, base, bz, nx, 0, nz, wall, u1, 0);
    const w2 = walls.vertex(bx, height, bz, nx, 0, nz, wall, u1, vTop);
    const w3 = walls.vertex(ax, height, az, nx, 0, nz, wall, u0, vTop);
    walls.quad(w0, w1, w2, w3, nx, 0, nz);

    if (!commercial) continue;
    // Shopfront: dark shutter/glass below, a coloured signboard band above.
    const split = 2.6;
    const s0 = solid.vertex(ax, 0, az, nx, 0, nz, C.shutter);
    const s1 = solid.vertex(bx, 0, bz, nx, 0, nz, C.shutter);
    const s2 = solid.vertex(bx, split, bz, nx, 0, nz, C.shutter);
    const s3 = solid.vertex(ax, split, az, nx, 0, nz, C.shutter);
    solid.quad(s0, s1, s2, s3, nx, 0, nz);
    const b0 = solid.vertex(ax, split, az, nx, 0, nz, shop);
    const b1 = solid.vertex(bx, split, bz, nx, 0, nz, shop);
    const b2 = solid.vertex(bx, SHOP_HEIGHT, bz, nx, 0, nz, shop);
    const b3 = solid.vertex(ax, SHOP_HEIGHT, az, nx, 0, nz, shop);
    solid.quad(b0, b1, b2, b3, nx, 0, nz);
    if (length > 3) {
      // Awning, visible from above and from the street below.
      const out = 0.8;
      for (const ny of [1, -1]) {
        const a0 = solid.vertex(ax, split + 0.1, az, 0, ny, 0, C.awning);
        const a1 = solid.vertex(bx, split + 0.1, bz, 0, ny, 0, C.awning);
        const a2 = solid.vertex(bx + nx * out, split, bz + nz * out, 0, ny, 0, C.awning);
        const a3 = solid.vertex(ax + nx * out, split, az + nz * out, 0, ny, 0, C.awning);
        solid.quad(a0, a1, a2, a3, 0, ny, 0);
      }
    }
  }

  const first = solid.vertexCount;
  for (let i = 0; i < n; i++) {
    solid.vertex(ring[i * 2] as number, height, ring[i * 2 + 1] as number, 0, 1, 0, roof);
  }
  const triangles = earcut(ring);
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    solid.triangle(
      first + (triangles[i] as number),
      first + (triangles[i + 1] as number),
      first + (triangles[i + 2] as number),
      0,
      1,
      0,
    );
  }

  if (flags & BUILDING_TANK) {
    const centre = centroid(ring);
    tanks.push(centre.x, height, centre.z);
  }
}

interface RibbonEdge {
  /** Left and right edge positions in the XZ plane, per polyline vertex. */
  lx: number[];
  lz: number[];
  rx: number[];
  rz: number[];
}

/** Mitred edge offsets for a polyline given as flat [x, y, z, ...]. */
function ribbonEdges(points: number[], half: number): RibbonEdge {
  const n = points.length / 3;
  const edge: RibbonEdge = { lx: [], lz: [], rx: [], rz: [] };
  for (let i = 0; i < n; i++) {
    const x = points[i * 3] as number;
    const z = points[i * 3 + 2] as number;
    let px = 0;
    let pz = 0;
    let first = true;
    let refX = 0;
    let refZ = 0;
    for (const k of [i - 1, i]) {
      if (k < 0 || k + 1 >= n) continue;
      const dx = (points[(k + 1) * 3] as number) - (points[k * 3] as number);
      const dz = (points[(k + 1) * 3 + 2] as number) - (points[k * 3 + 2] as number);
      const length = Math.hypot(dx, dz) || 1;
      px += -dz / length;
      pz += dx / length;
      if (first) {
        refX = -dz / length;
        refZ = dx / length;
        first = false;
      }
    }
    const length = Math.hypot(px, pz) || 1;
    px /= length;
    pz /= length;
    // Widen at corners so the ribbon keeps its width, but never spike on hairpins.
    const scale = half / Math.max(0.45, px * refX + pz * refZ);
    edge.lx.push(x + px * scale);
    edge.lz.push(z + pz * scale);
    edge.rx.push(x - px * scale);
    edge.rz.push(z - pz * scale);
  }
  return edge;
}

function addRibbon(
  ground: MeshBuilder,
  points: number[],
  half: number,
  lift: number,
  color: Rgb,
): RibbonEdge {
  const n = points.length / 3;
  const edge = ribbonEdges(points, half);
  let previousLeft = -1;
  let previousRight = -1;
  for (let i = 0; i < n; i++) {
    const y = (points[i * 3 + 1] as number) + lift;
    const left = ground.vertex(edge.lx[i] as number, y, edge.lz[i] as number, 0, 1, 0, color);
    const right = ground.vertex(edge.rx[i] as number, y, edge.rz[i] as number, 0, 1, 0, color);
    if (i > 0) ground.quad(previousLeft, previousRight, right, left, 0, 1, 0);
    previousLeft = left;
    previousRight = right;
  }
  // Round caps hide the seams where runs meet at junctions and chunk borders.
  for (const i of [0, n - 1]) {
    const cx = points[i * 3] as number;
    const cy = (points[i * 3 + 1] as number) + lift;
    const cz = points[i * 3 + 2] as number;
    const centre = ground.vertex(cx, cy, cz, 0, 1, 0, color);
    const steps = 10;
    let previous = -1;
    for (let s = 0; s <= steps; s++) {
      const angle = (s / steps) * Math.PI * 2;
      const v = ground.vertex(
        cx + Math.cos(angle) * half,
        cy,
        cz + Math.sin(angle) * half,
        0,
        1,
        0,
        color,
      );
      if (s > 0) ground.triangle(centre, previous, v, 0, 1, 0);
      previous = v;
    }
  }
  return edge;
}

function addDashes(ground: MeshBuilder, points: number[]): void {
  const dash = 3;
  const period = 9;
  const half = 0.09;
  let travelled = 0;
  const n = points.length / 3;
  for (let i = 0; i + 1 < n; i++) {
    const ax = points[i * 3] as number;
    const ay = points[i * 3 + 1] as number;
    const az = points[i * 3 + 2] as number;
    const dx = (points[(i + 1) * 3] as number) - ax;
    const dy = (points[(i + 1) * 3 + 1] as number) - ay;
    const dz = (points[(i + 1) * 3 + 2] as number) - az;
    const length = Math.hypot(dx, dz);
    if (length < 1e-3) continue;
    const ux = dx / length;
    const uz = dz / length;
    let start = (period - (travelled % period)) % period;
    for (; start < length; start += period) {
      const end = Math.min(start + dash, length);
      const corners: number[] = [];
      for (const [t, side] of [
        [start, 1],
        [end, 1],
        [end, -1],
        [start, -1],
      ] as const) {
        corners.push(
          ground.vertex(
            ax + ux * t - uz * half * side,
            ay + (dy * t) / length + MARKING_LIFT,
            az + uz * t + ux * half * side,
            0,
            1,
            0,
            C.marking,
          ),
        );
      }
      ground.quad(
        corners[0] as number,
        corners[1] as number,
        corners[2] as number,
        corners[3] as number,
        0,
        1,
        0,
      );
    }
    travelled += length;
  }
}

/** Sides, underside, parapets and pillars for an elevated run. */
function addDeck(solid: MeshBuilder, points: number[], edge: RibbonEdge, half: number): void {
  const n = points.length / 3;
  let sincePillar = PILLAR_SPACING / 2;
  for (let i = 0; i + 1 < n; i++) {
    const y0 = (points[i * 3 + 1] as number) + ROAD_LIFT;
    const y1 = (points[(i + 1) * 3 + 1] as number) + ROAD_LIFT;
    if (y0 < 0.6 && y1 < 0.6) continue;
    const b0 = Math.max(0, y0 - DECK_DEPTH);
    const b1 = Math.max(0, y1 - DECK_DEPTH);
    const dx = (points[(i + 1) * 3] as number) - (points[i * 3] as number);
    const dz = (points[(i + 1) * 3 + 2] as number) - (points[i * 3 + 2] as number);
    const length = Math.hypot(dx, dz) || 1;
    const px = -dz / length;
    const pz = dx / length;

    for (const side of [1, -1]) {
      const xs = side === 1 ? edge.lx : edge.rx;
      const zs = side === 1 ? edge.lz : edge.rz;
      const x0 = xs[i] as number;
      const z0 = zs[i] as number;
      const x1 = xs[i + 1] as number;
      const z1 = zs[i + 1] as number;
      const nx = px * side;
      const nz = pz * side;
      // Outer face: deck side plus parapet in one quad.
      const o0 = solid.vertex(x0, b0, z0, nx, 0, nz, C.concrete);
      const o1 = solid.vertex(x1, b1, z1, nx, 0, nz, C.concrete);
      const o2 = solid.vertex(x1, y1 + PARAPET_HEIGHT, z1, nx, 0, nz, C.concrete);
      const o3 = solid.vertex(x0, y0 + PARAPET_HEIGHT, z0, nx, 0, nz, C.concrete);
      solid.quad(o0, o1, o2, o3, nx, 0, nz);
      // Inner face of the parapet, seen from the carriageway.
      const i0 = solid.vertex(x0, y0, z0, -nx, 0, -nz, C.concreteDark);
      const i1 = solid.vertex(x1, y1, z1, -nx, 0, -nz, C.concreteDark);
      const i2 = solid.vertex(x1, y1 + PARAPET_HEIGHT, z1, -nx, 0, -nz, C.concreteDark);
      const i3 = solid.vertex(x0, y0 + PARAPET_HEIGHT, z0, -nx, 0, -nz, C.concreteDark);
      solid.quad(i0, i1, i2, i3, -nx, 0, -nz);
    }
    // Underside.
    const u0 = solid.vertex(
      edge.lx[i] as number,
      b0,
      edge.lz[i] as number,
      0,
      -1,
      0,
      C.concreteDark,
    );
    const u1 = solid.vertex(
      edge.rx[i] as number,
      b0,
      edge.rz[i] as number,
      0,
      -1,
      0,
      C.concreteDark,
    );
    const u2 = solid.vertex(
      edge.rx[i + 1] as number,
      b1,
      edge.rz[i + 1] as number,
      0,
      -1,
      0,
      C.concreteDark,
    );
    const u3 = solid.vertex(
      edge.lx[i + 1] as number,
      b1,
      edge.lz[i + 1] as number,
      0,
      -1,
      0,
      C.concreteDark,
    );
    solid.quad(u0, u1, u2, u3, 0, -1, 0);

    // Pillars at regular spacing wherever the deck is clear of the ground.
    sincePillar += length;
    while (sincePillar >= PILLAR_SPACING) {
      sincePillar -= PILLAR_SPACING;
      const t = Math.min(1, Math.max(0, 1 - sincePillar / length));
      const top = b0 + (b1 - b0) * t;
      if (top < 2.5) continue;
      const cx = (points[i * 3] as number) + dx * t;
      const cz = (points[i * 3 + 2] as number) + dz * t;
      const size = Math.min(1.1, half * 0.35);
      solid.box(cx - size, 0, cz - size, cx + size, top, cz + size, C.concreteDark);
    }
  }
}

function addRoad(record: number[], ground: MeshBuilder, solid: MeshBuilder): void {
  const half = ((record[0] ?? 0) * DM) / 2;
  const flags = record[1] ?? 0;
  const points: number[] = [];
  for (let i = 2; i + 2 < record.length; i += 3) {
    const x = (record[i] as number) * DM;
    const y = (record[i + 1] as number) * DM;
    const z = (record[i + 2] as number) * DM;
    const last = points.length - 3;
    // Drop repeated points; they would produce zero-length segments.
    if (
      last >= 0 &&
      Math.hypot(x - (points[last] as number), z - (points[last + 2] as number)) < 0.05
    )
      continue;
    points.push(x, y, z);
  }
  if (points.length < 6 || half <= 0) return;

  const rail = (flags & ROAD_RAIL) !== 0;
  const color = rail ? C.concrete : half < 2.6 ? C.asphaltMinor : C.asphalt;
  if (flags & ROAD_FOOTPATH)
    addRibbon(ground, points, half + FOOTPATH_EXTRA, FOOTPATH_LIFT, C.footpath);
  const edge = addRibbon(ground, points, half, ROAD_LIFT, color);
  if (flags & ROAD_MARKINGS) addDashes(ground, points);
  if (flags & ROAD_ELEVATED) addDeck(solid, points, edge, half);
}

/** Adds a flat filled polygon. `ring` is [x0, z0, ...] in metres. */
export function addArea(ground: MeshBuilder, kind: number, ring: number[]): void {
  if (ring.length < 6) return;
  const color = kind === AREA_WATER ? C.water : kind === AREA_PITCH ? C.pitch : C.green;
  const y = kind === AREA_WATER ? 0.02 : kind === AREA_PITCH ? 0.045 : 0.03;
  const first = ground.vertexCount;
  for (let i = 0; i + 1 < ring.length; i += 2) {
    ground.vertex(ring[i] as number, y, ring[i + 1] as number, 0, 1, 0, color);
  }
  const triangles = earcut(ring);
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    ground.triangle(
      first + (triangles[i] as number),
      first + (triangles[i + 1] as number),
      first + (triangles[i + 2] as number),
      0,
      1,
      0,
    );
  }
}

/** Mesh for areas stored in the world index (absolute decimetres). */
export function buildAreaMesh(records: readonly AreaRecord[]): MeshData {
  const ground = new MeshBuilder();
  for (const record of records) {
    addArea(
      ground,
      record[0] ?? 0,
      record.slice(1).map((value) => value * DM),
    );
  }
  return ground.build();
}

/** Turns one chunk file into renderable buffers. Positions are metres relative to the chunk's minimum corner. */
export function buildChunkMeshes(chunk: ChunkData): ChunkMeshes {
  const walls = new MeshBuilder(true);
  const solid = new MeshBuilder();
  const ground = new MeshBuilder();
  const tanks: number[] = [];

  for (const record of chunk.a)
    addArea(
      ground,
      record[0] ?? 0,
      record.slice(1).map((value) => value * DM),
    );
  for (const record of chunk.r) addRoad(record, ground, solid);
  for (const record of chunk.b) addBuilding(record, walls, solid, tanks);

  const treeCount = Math.floor(chunk.t.length / 5);
  const trees = new Float32Array(treeCount * 6);
  for (let i = 0; i < treeCount; i++) {
    trees[i * 6] = (chunk.t[i * 5] as number) * DM;
    trees[i * 6 + 1] = 0;
    trees[i * 6 + 2] = (chunk.t[i * 5 + 1] as number) * DM;
    trees[i * 6 + 3] = (chunk.t[i * 5 + 2] as number) * DM;
    trees[i * 6 + 4] = (chunk.t[i * 5 + 3] as number) * DM;
    trees[i * 6 + 5] = chunk.t[i * 5 + 4] as number;
  }

  return {
    walls: walls.build(),
    solid: solid.build(),
    ground: ground.build(),
    trees,
    tanks: new Float32Array(tanks),
  };
}
