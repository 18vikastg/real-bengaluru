/** Growable indexed-triangle builder with per-vertex normal, colour and optional UV. */
export interface MeshData {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  uv: Float32Array | null;
  index: Uint32Array;
}

export type Rgb = readonly [number, number, number];

export class MeshBuilder {
  private readonly position: number[] = [];
  private readonly normal: number[] = [];
  private readonly color: number[] = [];
  private readonly uv: number[] = [];
  private readonly index: number[] = [];
  private count = 0;

  constructor(private readonly withUv = false) {}

  get vertexCount(): number {
    return this.count;
  }

  vertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    c: Rgb,
    u = 0,
    v = 0,
  ): number {
    this.position.push(x, y, z);
    this.normal.push(nx, ny, nz);
    this.color.push(c[0], c[1], c[2]);
    if (this.withUv) this.uv.push(u, v);
    return this.count++;
  }

  /** Adds triangle (a, b, c), flipping it if needed so its face normal agrees with (nx, ny, nz). */
  triangle(a: number, b: number, c: number, nx: number, ny: number, nz: number): void {
    const p = this.position;
    const ax = p[a * 3] as number;
    const ay = p[a * 3 + 1] as number;
    const az = p[a * 3 + 2] as number;
    const ux = (p[b * 3] as number) - ax;
    const uy = (p[b * 3 + 1] as number) - ay;
    const uz = (p[b * 3 + 2] as number) - az;
    const vx = (p[c * 3] as number) - ax;
    const vy = (p[c * 3 + 1] as number) - ay;
    const vz = (p[c * 3 + 2] as number) - az;
    const facing = (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz;
    if (facing >= 0) this.index.push(a, b, c);
    else this.index.push(a, c, b);
  }

  /** Quad a-b-c-d (in perimeter order) facing (nx, ny, nz). */
  quad(a: number, b: number, c: number, d: number, nx: number, ny: number, nz: number): void {
    this.triangle(a, b, c, nx, ny, nz);
    this.triangle(a, c, d, nx, ny, nz);
  }

  /** Axis-aligned box from (x0, y0, z0) to (x1, y1, z1). */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: Rgb): void {
    const face = (
      nx: number,
      ny: number,
      nz: number,
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      cx: number,
      cy: number,
      cz: number,
      dx: number,
      dy: number,
      dz: number,
    ) => {
      const i0 = this.vertex(ax, ay, az, nx, ny, nz, c);
      const i1 = this.vertex(bx, by, bz, nx, ny, nz, c);
      const i2 = this.vertex(cx, cy, cz, nx, ny, nz, c);
      const i3 = this.vertex(dx, dy, dz, nx, ny, nz, c);
      this.quad(i0, i1, i2, i3, nx, ny, nz);
    };
    face(-1, 0, 0, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0);
    face(1, 0, 0, x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0);
    face(0, 0, -1, x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0);
    face(0, 0, 1, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
    face(0, 1, 0, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1);
  }

  build(): MeshData {
    return {
      position: new Float32Array(this.position),
      normal: new Float32Array(this.normal),
      color: new Float32Array(this.color),
      uv: this.withUv ? new Float32Array(this.uv) : null,
      index: new Uint32Array(this.index),
    };
  }
}
