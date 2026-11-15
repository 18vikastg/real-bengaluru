/** 2D polygon helpers on flat [x0, z0, x1, z1, ...] rings (not closed). */

export function signedArea(ring: ArrayLike<number>): number {
  let sum = 0;
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += (ring[i * 2] as number) * (ring[j * 2 + 1] as number);
    sum -= (ring[j * 2] as number) * (ring[i * 2 + 1] as number);
  }
  return sum / 2;
}

export function centroid(ring: ArrayLike<number>): { x: number; z: number } {
  const n = ring.length / 2;
  let cx = 0;
  let cz = 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = ring[i * 2] as number;
    const z0 = ring[i * 2 + 1] as number;
    const x1 = ring[j * 2] as number;
    const z1 = ring[j * 2 + 1] as number;
    const cross = x0 * z1 - x1 * z0;
    area += cross;
    cx += (x0 + x1) * cross;
    cz += (z0 + z1) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    // Degenerate: fall back to the vertex average.
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < n; i++) {
      sx += ring[i * 2] as number;
      sz += ring[i * 2 + 1] as number;
    }
    return { x: sx / Math.max(1, n), z: sz / Math.max(1, n) };
  }
  return { x: cx / (3 * area), z: cz / (3 * area) };
}

export function pointInPolygon(x: number, z: number, ring: ArrayLike<number>): boolean {
  const n = ring.length / 2;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i * 2] as number;
    const zi = ring[i * 2 + 1] as number;
    const xj = ring[j * 2] as number;
    const zj = ring[j * 2 + 1] as number;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
