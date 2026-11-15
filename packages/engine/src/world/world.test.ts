import { describe, expect, it } from 'vitest';
import { localToLatLon, projectToLocal } from '../geo';
import type { ChunkData } from './index';
import {
  BUILDING_COMMERCIAL,
  BUILDING_TANK,
  ROAD_ELEVATED,
  ROAD_FOOTPATH,
  ROAD_MARKINGS,
  buildAreaMesh,
  buildChunkMeshes,
  centroid,
  chunkCoord,
  chunksInRadius,
  hexToLinear,
  pointInPolygon,
  signedArea,
} from './index';

const SQUARE = [0, 0, 100, 0, 100, 100, 0, 100];

function chunk(partial: Partial<ChunkData>): ChunkData {
  return { v: 1, cx: 0, cz: 0, b: [], r: [], a: [], t: [], ...partial };
}

function bounds(position: Float32Array) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < position.length; i += 3) {
    minY = Math.min(minY, position[i] as number);
    maxY = Math.max(maxY, position[i] as number);
  }
  return { minY, maxY };
}

function allFinite(values: Float32Array): boolean {
  return values.every((value) => Number.isFinite(value));
}

describe('geo', () => {
  const origin = { lat: 12.929, lon: 77.6225 };

  it('puts the origin at zero, east at +x and north at -z', () => {
    expect(projectToLocal(origin, origin)).toEqual({ x: 0, z: -0 });
    expect(projectToLocal({ lat: origin.lat, lon: origin.lon + 0.01 }, origin).x).toBeGreaterThan(
      1000,
    );
    expect(projectToLocal({ lat: origin.lat + 0.01, lon: origin.lon }, origin).z).toBeLessThan(
      -1000,
    );
  });

  it('measures about 111 km per degree of latitude', () => {
    const { z } = projectToLocal({ lat: origin.lat + 1, lon: origin.lon }, origin);
    expect(Math.abs(z)).toBeGreaterThan(110_000);
    expect(Math.abs(z)).toBeLessThan(112_000);
  });

  it('round-trips', () => {
    const point = { lat: 12.9345, lon: 77.611 };
    const local = projectToLocal(point, origin);
    const back = localToLatLon(local.x, local.z, origin);
    expect(back.lat).toBeCloseTo(point.lat, 9);
    expect(back.lon).toBeCloseTo(point.lon, 9);
  });
});

describe('polygon', () => {
  it('computes area, centroid and containment', () => {
    expect(Math.abs(signedArea(SQUARE))).toBe(10_000);
    expect(signedArea([...SQUARE].reverse())).not.toBe(0);
    expect(centroid(SQUARE)).toEqual({ x: 50, z: 50 });
    expect(pointInPolygon(50, 50, SQUARE)).toBe(true);
    expect(pointInPolygon(150, 50, SQUARE)).toBe(false);
  });

  it('survives a degenerate ring', () => {
    expect(centroid([5, 5, 5, 5, 5, 5])).toEqual({ x: 5, z: 5 });
  });
});

describe('chunk grid', () => {
  it('floors negative coordinates', () => {
    expect(chunkCoord(-1, 250)).toBe(-1);
    expect(chunkCoord(0, 250)).toBe(0);
    expect(chunkCoord(250, 250)).toBe(1);
  });

  it('lists existing chunks nearest first', () => {
    const keys = chunksInRadius(125, 125, 400, 250, (key) => key !== '1,0');
    expect(keys[0]).toBe('0,0');
    expect(keys).not.toContain('1,0');
    expect(keys).toContain('-1,0');
    expect(chunksInRadius(0, 0, 400, 250, () => false)).toEqual([]);
  });
});

describe('buildChunkMeshes', () => {
  it('extrudes a building to its height with a roof and outward walls', () => {
    for (const ring of [SQUARE, [0, 100, 100, 100, 100, 0, 0, 0]]) {
      const meshes = buildChunkMeshes(chunk({ b: [[93, 0, 0, 0, 0, ...ring]] }));
      expect(meshes.walls.position.length / 3).toBe(16);
      expect(meshes.walls.index.length).toBe(24);
      expect(bounds(meshes.walls.position)).toEqual({ minY: 0, maxY: expect.closeTo(9.3, 5) });
      expect(meshes.solid.index.length).toBe(6); // roof: two triangles
      expect(meshes.walls.uv).not.toBeNull();
      // Every wall normal points away from the building centre, whatever the ring winding.
      const { position, normal } = meshes.walls;
      for (let i = 0; i < position.length; i += 3) {
        const outward =
          ((position[i] as number) - 5) * (normal[i] as number) +
          ((position[i + 2] as number) - 5) * (normal[i + 2] as number);
        expect(outward).toBeGreaterThan(0);
      }
    }
  });

  it('adds a shopfront and a rooftop tank when flagged', () => {
    const plain = buildChunkMeshes(chunk({ b: [[124, 1, 1, 0, 2, ...SQUARE]] }));
    const shop = buildChunkMeshes(
      chunk({ b: [[124, 1, 1, BUILDING_COMMERCIAL | BUILDING_TANK, 2, ...SQUARE]] }),
    );
    expect(shop.solid.index.length).toBeGreaterThan(plain.solid.index.length);
    expect(bounds(shop.walls.position).minY).toBeCloseTo(3.4, 5);
    expect(Array.from(shop.tanks)).toEqual([5, expect.closeTo(12.4, 5), 5]);
    expect(plain.tanks.length).toBe(0);
  });

  it('skips degenerate buildings', () => {
    const meshes = buildChunkMeshes(
      chunk({
        b: [
          [90, 0, 0, 0, 0, 0, 0, 10, 10],
          [0, 0, 0, 0, 0, ...SQUARE],
        ],
      }),
    );
    expect(meshes.walls.index.length).toBe(0);
  });

  it('builds a flat road with footpath and markings, and no deck', () => {
    const road = [80, ROAD_FOOTPATH | ROAD_MARKINGS, 0, 0, 0, 500, 0, 0, 1000, 0, 300];
    const meshes = buildChunkMeshes(chunk({ r: [road] }));
    expect(meshes.ground.index.length).toBeGreaterThan(0);
    expect(meshes.solid.index.length).toBe(0);
    expect(bounds(meshes.ground.position).maxY).toBeLessThan(0.3);
    expect(allFinite(meshes.ground.position)).toBe(true);
    // All ground triangles face up.
    const { position, index } = meshes.ground;
    for (let i = 0; i < index.length; i += 3) {
      const [a, b, c] = [index[i] as number, index[i + 1] as number, index[i + 2] as number];
      const ux = (position[b * 3] as number) - (position[a * 3] as number);
      const uz = (position[b * 3 + 2] as number) - (position[a * 3 + 2] as number);
      const vx = (position[c * 3] as number) - (position[a * 3] as number);
      const vz = (position[c * 3 + 2] as number) - (position[a * 3 + 2] as number);
      expect(uz * vx - ux * vz).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives an elevated road a deck and pillars', () => {
    const flyover = [100, ROAD_ELEVATED, 0, 0, 0, 600, 70, 0, 1500, 70, 0];
    const meshes = buildChunkMeshes(chunk({ r: [flyover] }));
    expect(meshes.solid.index.length).toBeGreaterThan(0);
    expect(bounds(meshes.ground.position).maxY).toBeGreaterThan(7);
    expect(bounds(meshes.solid.position).minY).toBe(0); // pillars reach the ground
  });

  it('ignores roads with repeated or too few points', () => {
    const meshes = buildChunkMeshes(
      chunk({
        r: [
          [80, 0, 0, 0, 0, 0, 0, 0],
          [80, 0, 5, 0, 5],
        ],
      }),
    );
    expect(meshes.ground.index.length).toBe(0);
  });

  it('passes trees through in metres and triangulates areas', () => {
    const meshes = buildChunkMeshes(chunk({ t: [100, 200, 55, 30, 2], a: [[1, ...SQUARE]] }));
    expect(Array.from(meshes.trees)).toEqual([10, 0, 20, 5.5, 3, 2]);
    expect(meshes.ground.index.length).toBe(6);
    expect(buildAreaMesh([[0, ...SQUARE]]).index.length).toBe(6);
  });
});

describe('palette', () => {
  it('converts sRGB hex to linear', () => {
    expect(hexToLinear('#000000')).toEqual([0, 0, 0]);
    expect(hexToLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToLinear('#808080')[0]).toBeCloseTo(0.2158, 3);
  });
});
