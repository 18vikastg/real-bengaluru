import type { ChunkData, TrafficZone, WorldIndex } from '@blr/engine';
import {
  ROAD_ELEVATED,
  ROAD_FOOTPATH,
  ROAD_MARKINGS,
  ROAD_RAIL,
  congestion,
  speedFactor,
  zoneAt,
} from '@blr/engine';
import * as THREE from 'three';
import type { Figure, ModelKit } from './models';

/**
 * Background life: cars, autos and buses driving the streets around the
 * player, and people walking along them. There is no navigation graph;
 * each one follows a road's centreline from the baked map and, at its end,
 * carries on along whichever road starts there. They keep left, slow down
 * in jams and rain, and brake for the player and for each other.
 */
interface Road {
  /** World-space x, y, z triples along the centreline. */
  points: Float32Array;
  count: number;
  half: number;
  major: boolean;
  footpath: boolean;
  elevated: boolean;
}

interface Agent {
  walker: boolean;
  group: THREE.Group;
  figure: Figure | null;
  road: Road;
  /** Index of the point the agent last passed, and metres travelled beyond it. */
  index: number;
  along: number;
  /** +1 follows the centreline forwards, -1 backwards. */
  step: 1 | -1;
  /** Metres to the side of the centreline (left of travel is positive). */
  offset: number;
  cruise: number;
  speed: number;
  stride: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
}

const SPAWN_NEAR = 45;
const SPAWN_FAR = 230;
const DESPAWN = 300;
const JOIN_DISTANCE = 7;
const CAR_COLOURS = ['#e8e6e1', '#b9bcc2', '#2b2e35', '#8c1d1d', '#1f4f8a', '#d9d2c0', '#5b5f66'];
const SHIRTS = [
  '#c0392b',
  '#2e86c1',
  '#27ae60',
  '#d4ac0d',
  '#8e44ad',
  '#e67e22',
  '#ecf0f1',
  '#34495e',
];
const TROUSERS = ['#2b2f3a', '#4a4136', '#2f4a7a', '#5d6d7e', '#6e2c00'];
const SKINS = ['#8d5a3b', '#96603f', '#a26b47', '#7f5237', '#a8734f'];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

export class AmbientLife {
  private readonly roads = new Map<string, Road[]>();
  private readonly loading = new Set<string>();
  private readonly agents: Agent[] = [];
  private index: WorldIndex | null = null;
  private known = new Set<string>();
  private all: Road[] = [];
  private spawnTimer = 0;
  private disposed = false;

  constructor(
    private readonly kit: ModelKit,
    private readonly parent: THREE.Object3D,
    private readonly baseUrl: string,
  ) {}

  setIndex(index: WorldIndex): void {
    this.index = index;
    this.known = new Set(index.chunks);
  }

  /** Keeps the road centrelines of the chunks around a point in memory. */
  private refreshRoads(x: number, z: number): void {
    const index = this.index;
    if (!index) return;
    const cx = Math.floor(x / index.chunkSize);
    const cz = Math.floor(z / index.chunkSize);
    const wanted = new Set<string>();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) wanted.add(`${cx + dx},${cz + dz}`);
    }
    let changed = false;
    for (const key of this.roads.keys()) {
      if (!wanted.has(key)) {
        this.roads.delete(key);
        changed = true;
      }
    }
    for (const key of wanted) {
      if (this.roads.has(key) || this.loading.has(key) || !this.known.has(key)) continue;
      this.loading.add(key);
      void this.load(key, index.chunkSize);
    }
    if (changed) this.all = [...this.roads.values()].flat();
  }

  private async load(key: string, size: number): Promise<void> {
    try {
      // The streamer's worker has already fetched this file, so it comes from the HTTP cache.
      const response = await fetch(`${this.baseUrl}${key.replace(',', '_')}.json`);
      if (!response.ok || this.disposed) return;
      const chunk = (await response.json()) as ChunkData;
      const ox = chunk.cx * size;
      const oz = chunk.cz * size;
      const roads: Road[] = [];
      for (const record of chunk.r) {
        const flags = record[1] ?? 0;
        if (flags & ROAD_RAIL) continue;
        const count = Math.floor((record.length - 2) / 3);
        if (count < 2) continue;
        const points = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          points[i * 3] = ox + (record[2 + i * 3] ?? 0) / 10;
          points[i * 3 + 1] = (record[3 + i * 3] ?? 0) / 10;
          points[i * 3 + 2] = oz + (record[4 + i * 3] ?? 0) / 10;
        }
        roads.push({
          points,
          count,
          half: (record[0] ?? 40) / 20,
          major: (flags & ROAD_MARKINGS) !== 0,
          footpath: (flags & ROAD_FOOTPATH) !== 0,
          elevated: (flags & ROAD_ELEVATED) !== 0,
        });
      }
      this.roads.set(key, roads);
      this.all = [...this.roads.values()].flat();
    } catch {
      // A missing chunk only means fewer cars on that block.
    } finally {
      this.loading.delete(key);
    }
  }

  private spawn(walker: boolean, px: number, pz: number): void {
    for (let attempt = 0; attempt < 6; attempt++) {
      const road = pick(this.all);
      if (walker ? road.elevated : road.half < 2.4 || (!road.major && Math.random() < 0.6))
        continue;
      const index = Math.floor(Math.random() * (road.count - 1));
      const x = road.points[index * 3] as number;
      const z = road.points[index * 3 + 2] as number;
      const distance = Math.hypot(x - px, z - pz);
      if (distance < SPAWN_NEAR || distance > SPAWN_FAR) continue;

      let group: THREE.Group;
      let figure: Figure | null = null;
      let cruise: number;
      if (walker) {
        figure = this.kit.figure({
          shirt: pick(SHIRTS),
          trousers: pick(TROUSERS),
          skin: pick(SKINS),
          hair: '#17120f',
        });
        group = figure.group;
        cruise = 1.1 + Math.random() * 0.6;
      } else {
        const roll = Math.random();
        if (roll < 0.4) group = this.kit.auto();
        else if (roll < 0.52 && road.major)
          group = this.kit.bus(Math.random() < 0.3 ? '#c23a2e' : '#2d6fb5');
        else group = this.kit.car(pick(CAR_COLOURS));
        cruise = 8 + Math.random() * 4;
      }
      const step = Math.random() < 0.5 ? 1 : -1;
      const agent: Agent = {
        walker,
        group,
        figure,
        road,
        index: step === 1 ? index : index + 1,
        along: 0,
        step,
        offset: walker
          ? (road.half + 0.9) * (Math.random() < 0.5 ? 1 : -1)
          : THREE.MathUtils.clamp(road.half * 0.45, 1.1, 3.4),
        cruise,
        speed: cruise,
        stride: Math.random() * 6,
        x,
        z,
        dx: 0,
        dz: 1,
      };
      this.parent.add(group);
      this.agents.push(agent);
      return;
    }
  }

  /** At the end of a road, find one that starts (or ends) there and carry on along it. */
  private carryOn(agent: Agent): boolean {
    const road = agent.road;
    const end = agent.step === 1 ? road.count - 1 : 0;
    const ex = road.points[end * 3] as number;
    const ez = road.points[end * 3 + 2] as number;
    const options: { road: Road; step: 1 | -1 }[] = [];
    for (const other of this.all) {
      if (other === road) continue;
      if (agent.walker ? other.elevated : other.half < 2.4) continue;
      const last = other.count - 1;
      if (
        Math.hypot((other.points[0] as number) - ex, (other.points[2] as number) - ez) <
        JOIN_DISTANCE
      ) {
        options.push({ road: other, step: 1 });
      } else if (
        Math.hypot(
          (other.points[last * 3] as number) - ex,
          (other.points[last * 3 + 2] as number) - ez,
        ) < JOIN_DISTANCE
      ) {
        options.push({ road: other, step: -1 });
      }
    }
    if (options.length === 0) return false;
    // Prefer to keep going roughly straight rather than doubling back.
    let best = options[0] as { road: Road; step: 1 | -1 };
    let bestScore = -Infinity;
    for (const option of options) {
      const a = option.step === 1 ? 0 : option.road.count - 1;
      const b = a + option.step;
      const ox = (option.road.points[b * 3] as number) - (option.road.points[a * 3] as number);
      const oz =
        (option.road.points[b * 3 + 2] as number) - (option.road.points[a * 3 + 2] as number);
      const length = Math.hypot(ox, oz) || 1;
      const score = (ox * agent.dx + oz * agent.dz) / length + Math.random() * 0.9;
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    agent.road = best.road;
    agent.step = best.step;
    agent.index = best.step === 1 ? 0 : best.road.count - 1;
    agent.along = 0;
    if (!agent.walker) agent.offset = THREE.MathUtils.clamp(best.road.half * 0.45, 1.1, 3.4);
    else agent.offset = Math.sign(agent.offset) * (best.road.half + 0.9);
    return true;
  }

  private remove(position: number): void {
    const agent = this.agents[position];
    if (!agent) return;
    this.parent.remove(agent.group);
    this.agents.splice(position, 1);
  }

  update(
    dt: number,
    px: number,
    pz: number,
    hour: number,
    raining: boolean,
    zones: readonly TrafficZone[],
  ): void {
    if (!this.index) return;
    this.refreshRoads(px, pz);
    if (this.all.length === 0) return;

    const jam = congestion(hour);
    const night = hour >= 22.5 || hour < 5;
    const wantVehicles = Math.round(night ? 4 : 7 + jam * 13);
    const wantWalkers = raining ? 4 : night ? 3 : 14;
    let vehicles = 0;
    for (const agent of this.agents) if (!agent.walker) vehicles++;
    const walkers = this.agents.length - vehicles;
    this.spawnTimer += dt;
    if (this.spawnTimer > 0.15) {
      this.spawnTimer = 0;
      if (vehicles < wantVehicles) this.spawn(false, px, pz);
      if (walkers < wantWalkers) this.spawn(true, px, pz);
    }

    for (let i = this.agents.length - 1; i >= 0; i--) {
      const agent = this.agents[i] as Agent;
      const road = agent.road;
      let next = agent.index + agent.step;
      if (next < 0 || next >= road.count) {
        if (!this.carryOn(agent)) {
          this.remove(i);
          continue;
        }
        next = agent.index + agent.step;
      }
      const p = agent.road.points;
      const ax = p[agent.index * 3] as number;
      const ay = p[agent.index * 3 + 1] as number;
      const az = p[agent.index * 3 + 2] as number;
      const bx = p[next * 3] as number;
      const by = p[next * 3 + 1] as number;
      const bz = p[next * 3 + 2] as number;
      const length = Math.hypot(bx - ax, bz - az) || 0.001;
      const dx = (bx - ax) / length;
      const dz = (bz - az) / length;

      // Decide how fast to go: traffic, weather, and whatever is in the way.
      let target = agent.cruise;
      if (!agent.walker) {
        target *= speedFactor(hour, raining, zoneAt(zones, agent.x, agent.z));
        const gap = this.gapAhead(agent, px, pz);
        if (gap < 5) target = 0;
        else if (gap < 12) target *= (gap - 5) / 7;
      }
      agent.speed +=
        (target - agent.speed) * (1 - Math.exp(-dt * (target < agent.speed ? 4 : 1.2)));

      agent.along += agent.speed * dt;
      if (agent.along >= length) {
        agent.along -= length;
        agent.index = next;
        continue; // position updates next frame from the new segment
      }
      const t = agent.along / length;
      // Left of the direction of travel: India drives, and mostly walks, on the left.
      agent.x = ax + (bx - ax) * t + dz * agent.offset;
      agent.z = az + (bz - az) * t - dx * agent.offset;
      agent.dx = dx;
      agent.dz = dz;
      if (Math.hypot(agent.x - px, agent.z - pz) > DESPAWN) {
        this.remove(i);
        continue;
      }
      const heading = Math.atan2(-dx, -dz);
      agent.group.position.set(agent.x, ay + (by - ay) * t, agent.z);
      if (agent.figure) {
        agent.group.rotation.y = heading + Math.PI;
        agent.stride += agent.speed * dt * 2.4;
        const swing = Math.sin(agent.stride) * 0.5;
        agent.figure.legs[0].rotation.x = swing;
        agent.figure.legs[1].rotation.x = -swing;
        agent.figure.arms[0].rotation.x = -swing * 0.7;
        agent.figure.arms[1].rotation.x = swing * 0.7;
      } else {
        const turn = Math.atan2(
          Math.sin(heading - agent.group.rotation.y),
          Math.cos(heading - agent.group.rotation.y),
        );
        agent.group.rotation.y += turn * (1 - Math.exp(-dt * 6));
      }
    }
  }

  /** Metres to the nearest thing in this vehicle's lane ahead: the player or another vehicle. */
  private gapAhead(agent: Agent, px: number, pz: number): number {
    let gap = Infinity;
    const consider = (x: number, z: number) => {
      const rx = x - agent.x;
      const rz = z - agent.z;
      const ahead = rx * agent.dx + rz * agent.dz;
      if (ahead <= 0.5 || ahead > 14) return;
      if (Math.abs(rx * agent.dz - rz * agent.dx) < 1.9 && ahead < gap) gap = ahead;
    };
    consider(px, pz);
    for (const other of this.agents) {
      if (other !== agent && !other.walker) consider(other.x, other.z);
    }
    return gap;
  }

  dispose(): void {
    this.disposed = true;
    for (const agent of this.agents) this.parent.remove(agent.group);
    this.agents.length = 0;
    this.roads.clear();
    this.all = [];
  }
}
