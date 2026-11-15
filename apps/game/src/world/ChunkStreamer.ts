import type { MeshData, WorldIndex } from '@blr/engine';
import { buildAreaMesh, chunksInRadius } from '@blr/engine';
import * as THREE from 'three';
import type { ChunkRequest, ChunkResponse } from './chunk.worker';
import type { WorldMaterials } from './materials';

/** Chunks whose centre is within this distance of the focus point are kept loaded. */
export const LOAD_RADIUS = 1000;
const UNLOAD_RADIUS = LOAD_RADIUS + 300;
const DETAIL_RADIUS = 480;
const TREE_RADIUS = 720;
const MAX_PENDING = 4;

interface LoadedChunk {
  group: THREE.Group;
  detail: THREE.Object3D[];
  trees: THREE.Object3D[];
  casters: THREE.Object3D[];
  centreX: number;
  centreZ: number;
}

export interface StreamerStatus {
  loaded: number;
  pending: number;
  total: number;
  /** Name of the nearest mapped place, if one is close. */
  near: string | null;
}

function toGeometry(data: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.color, 3));
  if (data.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Keeps the world around a moving focus point loaded. Chunk files are fetched
 * and turned into buffers in a worker; the main thread only uploads them.
 */
export class ChunkStreamer {
  readonly root = new THREE.Group();
  private readonly worker: Worker;
  private readonly loaded = new Map<string, LoadedChunk>();
  private readonly pending = new Set<string>();
  private readonly failed = new Set<string>();
  private index: WorldIndex | null = null;
  private existing = new Set<string>();
  private wanted: string[] = [];
  private lastX = Number.NaN;
  private lastZ = Number.NaN;
  private disposed = false;
  private readonly scratch = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  constructor(
    private readonly baseUrl: string,
    private readonly materials: WorldMaterials,
    private readonly onStatus: (status: StreamerStatus) => void,
  ) {
    this.worker = new Worker(new URL('./chunk.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<ChunkResponse>) => this.receive(event.data);
    void this.loadIndex();
  }

  get worldIndex(): WorldIndex | null {
    return this.index;
  }

  private async loadIndex(): Promise<void> {
    const response = await fetch(`${this.baseUrl}index.json`);
    if (!response.ok) throw new Error(`World index failed to load: HTTP ${response.status}`);
    const index = (await response.json()) as WorldIndex;
    if (this.disposed) return;
    this.index = index;
    this.existing = new Set(index.chunks);

    // Lakes and large parks span many chunks, so they are always present.
    const areas = new THREE.Mesh(
      toGeometry(buildAreaMesh(index.globalAreas)),
      this.materials.ground,
    );
    areas.receiveShadow = true;
    this.root.add(areas);
  }

  /** Call every frame with the point the world should be loaded around. */
  update(x: number, z: number): void {
    const index = this.index;
    if (!index) return;
    if (Math.hypot(x - this.lastX, z - this.lastZ) < 25 && this.wanted.length === 0) return;

    if (!(Math.hypot(x - this.lastX, z - this.lastZ) < 25)) {
      this.lastX = x;
      this.lastZ = z;
      this.wanted = chunksInRadius(x, z, LOAD_RADIUS, index.chunkSize, (key) =>
        this.existing.has(key),
      ).filter((key) => !this.loaded.has(key) && !this.pending.has(key) && !this.failed.has(key));
      for (const [key, chunk] of this.loaded) {
        const distance = Math.hypot(chunk.centreX - x, chunk.centreZ - z);
        if (distance > UNLOAD_RADIUS) this.unload(key);
        else this.applyDetail(chunk, distance);
      }
      this.report();
    }

    while (this.pending.size < MAX_PENDING && this.wanted.length > 0) {
      const key = this.wanted.shift() as string;
      this.pending.add(key);
      const request: ChunkRequest = { key, url: `${this.baseUrl}${key.replace(',', '_')}.json` };
      this.worker.postMessage(request);
    }
  }

  private applyDetail(chunk: LoadedChunk, distance: number): void {
    const near = distance < DETAIL_RADIUS;
    for (const object of chunk.detail) object.visible = near;
    for (const object of chunk.trees) object.visible = distance < TREE_RADIUS;
    for (const object of chunk.casters) object.castShadow = near;
  }

  private receive(message: ChunkResponse): void {
    this.pending.delete(message.key);
    if (this.disposed || !this.index) return;
    if (!message.ok) {
      this.failed.add(message.key);
      console.error(`Chunk ${message.key} failed to load: ${message.error}`);
      this.report();
      return;
    }
    const size = this.index.chunkSize;
    const centreX = (message.cx + 0.5) * size;
    const centreZ = (message.cz + 0.5) * size;
    const distance = Math.hypot(centreX - this.lastX, centreZ - this.lastZ);
    if (distance > UNLOAD_RADIUS) {
      this.report();
      return; // The camera moved away while this was loading.
    }

    const { meshes } = message;
    const group = new THREE.Group();
    group.position.set(message.cx * size, 0, message.cz * size);
    const chunk: LoadedChunk = { group, detail: [], trees: [], casters: [], centreX, centreZ };

    const ground = new THREE.Mesh(toGeometry(meshes.ground), this.materials.ground);
    ground.receiveShadow = true;
    group.add(ground);
    if (meshes.walls.index.length > 0) {
      const walls = new THREE.Mesh(toGeometry(meshes.walls), this.materials.wall);
      walls.receiveShadow = true;
      group.add(walls);
      chunk.casters.push(walls);
    }
    if (meshes.solid.index.length > 0) {
      const solid = new THREE.Mesh(toGeometry(meshes.solid), this.materials.solid);
      solid.receiveShadow = true;
      group.add(solid);
      chunk.casters.push(solid);
    }

    const treeCount = meshes.trees.length / 6;
    if (treeCount > 0) {
      const trunks = new THREE.InstancedMesh(
        this.materials.trunkGeometry,
        this.materials.trunk,
        treeCount,
      );
      const canopies = new THREE.InstancedMesh(
        this.materials.canopyGeometry,
        this.materials.canopy,
        treeCount,
      );
      for (let i = 0; i < treeCount; i++) {
        const x = meshes.trees[i * 6] as number;
        const z = meshes.trees[i * 6 + 2] as number;
        const height = meshes.trees[i * 6 + 3] as number;
        const radius = meshes.trees[i * 6 + 4] as number;
        this.scratch.compose(
          this.position.set(x, 0, z),
          this.rotation,
          this.scale.set(1, height, 1),
        );
        trunks.setMatrixAt(i, this.scratch);
        this.scratch.compose(
          this.position.set(x, height + radius * 0.4, z),
          this.rotation,
          this.scale.set(radius, radius * 0.72, radius),
        );
        canopies.setMatrixAt(i, this.scratch);
        const colour =
          this.materials.treeColors[
            (meshes.trees[i * 6 + 5] as number) % this.materials.treeColors.length
          ];
        if (colour) canopies.setColorAt(i, colour);
      }
      canopies.receiveShadow = true;
      for (const mesh of [trunks, canopies]) {
        mesh.computeBoundingSphere();
        group.add(mesh);
        chunk.trees.push(mesh);
      }
      chunk.casters.push(canopies);
    }

    const tankCount = meshes.tanks.length / 3;
    if (tankCount > 0) {
      const tanks = new THREE.InstancedMesh(
        this.materials.tankGeometry,
        this.materials.tank,
        tankCount,
      );
      for (let i = 0; i < tankCount; i++) {
        this.scratch.makeTranslation(
          meshes.tanks[i * 3] as number,
          meshes.tanks[i * 3 + 1] as number,
          meshes.tanks[i * 3 + 2] as number,
        );
        tanks.setMatrixAt(i, this.scratch);
      }
      tanks.computeBoundingSphere();
      group.add(tanks);
      chunk.detail.push(tanks);
    }

    this.applyDetail(chunk, distance);
    this.root.add(group);
    this.loaded.set(message.key, chunk);
    this.report();
  }

  private unload(key: string): void {
    const chunk = this.loaded.get(key);
    if (!chunk) return;
    this.root.remove(chunk.group);
    for (const child of chunk.group.children) {
      if (child instanceof THREE.InstancedMesh) child.dispose();
      else if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    this.loaded.delete(key);
  }

  private report(): void {
    let near: string | null = null;
    let best = 350;
    for (const place of this.index?.places ?? []) {
      const distance = Math.hypot(place.x - this.lastX, place.z - this.lastZ);
      if (distance < best) {
        best = distance;
        near = place.name;
      }
    }
    this.onStatus({
      loaded: this.loaded.size,
      pending: this.pending.size + this.wanted.length,
      total: this.existing.size,
      near,
    });
  }

  dispose(): void {
    this.disposed = true;
    this.worker.terminate();
    for (const key of [...this.loaded.keys()]) this.unload(key);
    for (const child of this.root.children) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    this.root.clear();
  }
}
