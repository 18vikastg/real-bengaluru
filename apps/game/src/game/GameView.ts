import { NPCS, PARKED_AUTOS, STATIONS } from '@blr/content';
import type { WorldIndex } from '@blr/engine';
import { speedFactor, zoneAt } from '@blr/engine';
import * as THREE from 'three';
import {
  PLACE_NAMES,
  autoHome,
  contextOf,
  npcPosition,
  stationPosition,
  trackerFor,
  useCity,
} from '../state/city';
import { useUi } from '../state/ui';
import { ChunkStreamer } from '../world/ChunkStreamer';
import type { WorldMaterials } from '../world/materials';
import { createWorldMaterials } from '../world/materials';
import { Atmosphere } from './Atmosphere';
import type { Figure } from './models';
import { ModelKit } from './models';

const WALK_SPEED = 5;
const RUN_SPEED = 8.5;
const AUTO_SPEED = 16;
const AUTO_REVERSE = 5;
const PLAYER_RADIUS = 0.45;
const AUTO_RADIUS = 1.25;
const AUTO_REACH = 4.2;
const FLY_SPEED = 45;
const MIN_PITCH = 0.06;
const MAX_PITCH = 1.25;
const PLAYER_LOOK = {
  shirt: '#f5c518',
  trousers: '#2f4a7a',
  skin: '#96603f',
  hair: '#17120f',
};

interface Auto {
  id: string;
  group: THREE.Group;
  x: number;
  z: number;
  heading: number;
}

interface Npc {
  id: string;
  figure: Figure;
  label: THREE.Sprite;
  marker: THREE.Mesh;
  phase: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const scratch = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * The 3D side of the game: owns the renderer, the streamed city, the player
 * (on foot, driving an auto, or flying the drone camera) and everyone
 * standing around in the world. Game rules live in the city store; this
 * class only moves things and reports where the player is.
 */
export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2600);
  private readonly materials: WorldMaterials = createWorldMaterials();
  private readonly streamer: ChunkStreamer;
  private readonly atmosphere: Atmosphere;
  private readonly kit = new ModelKit();
  private readonly ground: THREE.Mesh;
  private readonly resizer: ResizeObserver;
  private readonly raycaster = new THREE.Raycaster();
  private readonly lamp = new THREE.PointLight('#ffd9a0', 0, 34, 1.6);

  private readonly avatar: Figure;
  private readonly beacon: THREE.Group;
  private readonly npcs: Npc[] = [];
  private readonly autos: Auto[] = [];
  private readonly actors = new THREE.Group();

  private readonly keys = new Set<string>();
  private dragging = false;
  private lastDrag = -10;
  private index: WorldIndex | null = null;
  private warpSeq = -1;
  private interactSeq = 0;
  private droneSeq = 0;
  private disposed = false;

  // Player state. Heading 0 faces north (-z); forward is (-sin h, -cos h).
  private x = 0;
  private z = 0;
  private heading = 0;
  private speed = 0;
  private stride = 0;
  private driving: Auto | null = null;

  // Camera rig: orbit angles around the player, or a free pose in drone mode.
  private yaw = 0;
  private pitch = 0.2;
  private distance = 8.5;
  private readonly flyVelocity = new THREE.Vector3();
  private flyYaw = 0;
  private flyPitch = -0.4;

  private last = 0;
  private clockTimer = 0;
  private reportTimer = 0;
  private placeTimer = 1;
  private wallTimer = 1;
  private frames = 0;
  private frameTime = 0;
  private walls: THREE.Object3D[] = [];

  constructor(
    private readonly host: HTMLElement,
    baseUrl: string,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const canvas = this.renderer.domElement;
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(canvas);

    this.camera.position.set(-150, 150, 320);
    this.atmosphere = new Atmosphere(this.scene, this.materials);
    this.streamer = new ChunkStreamer(baseUrl, this.materials, (status) =>
      useUi.getState().setWorld(status),
    );
    this.scene.add(this.streamer.root);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(14000, 14000),
      new THREE.MeshStandardMaterial({ color: '#9c8f76', roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.avatar = this.kit.figure(PLAYER_LOOK, true);
    this.beacon = this.kit.beacon();
    this.beacon.visible = false;
    this.actors.add(this.avatar.group, this.beacon, this.lamp);
    this.scene.add(this.actors);

    for (const def of NPCS) {
      const figure = this.kit.figure(def.look);
      const label = this.kit.label(def.name, def.role);
      label.position.y = 2.2;
      const marker = this.kit.marker();
      figure.group.add(label, marker);
      figure.group.visible = false;
      this.actors.add(figure.group);
      this.npcs.push({ id: def.id, figure, label, marker, phase: Math.random() * 6 });
    }

    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(host);
    this.resize();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.interactSeq = useCity.getState().interactSeq;
    this.droneSeq = useCity.getState().droneSeq;
    this.renderer.setAnimationLoop(this.frame);
  }

  // ------------------------------------------------------------------ input

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (useUi.getState().phase !== 'playing') return;
    const city = useCity.getState();
    if (!event.repeat) {
      if (event.code === 'KeyE') this.interact();
      else if (event.code === 'KeyF') this.toggleDrone();
      else if (event.code === 'KeyG') city.openPanel('guide');
      else if (event.code === 'KeyM') city.openPanel('missions');
      else if (city.conversation && /^Digit[1-9]$/.test(event.code)) {
        city.reply(Number(event.code.slice(5)) - 1);
      }
    }
    this.keys.add(event.code);
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    const canvas = this.renderer.domElement;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging || useUi.getState().phase !== 'playing') return;
    this.lastDrag = this.last;
    if (useCity.getState().mode === 'drone') {
      this.flyYaw -= event.movementX * 0.0032;
      this.flyPitch = THREE.MathUtils.clamp(this.flyPitch - event.movementY * 0.0032, -1.5, 1.2);
    } else {
      this.yaw -= event.movementX * 0.005;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + event.movementY * 0.004,
        MIN_PITCH,
        MAX_PITCH,
      );
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (useCity.getState().mode === 'drone') {
      this.camera.getWorldDirection(scratch);
      this.camera.position.addScaledVector(scratch, -event.deltaY * 0.25);
    } else {
      this.distance = THREE.MathUtils.clamp(this.distance + event.deltaY * 0.012, 3.5, 34);
    }
  };

  private held(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  // ------------------------------------------------------------------ actions

  /** E, or a click on the prompt: talk, board, or get in or out of an auto. */
  private interact(): void {
    const city = useCity.getState();
    if (city.conversation || city.travel || city.panel) return;
    if (this.driving) this.leaveAuto();
    else if (city.prompt?.kind === 'auto') this.enterAuto(city.prompt.id);
    else city.interact();
  }

  private enterAuto(id: string): void {
    const auto = this.autos.find((entry) => entry.id === id);
    if (!auto) return;
    this.driving = auto;
    this.x = auto.x;
    this.z = auto.z;
    this.heading = auto.heading;
    this.speed = 0;
    this.avatar.group.visible = false;
    useCity.getState().setMode('auto');
  }

  private leaveAuto(): void {
    const auto = this.driving;
    if (!auto) return;
    this.driving = null;
    this.speed = 0;
    // Step out on the kerb side (the auto's left).
    this.x = auto.x - Math.cos(auto.heading) * 1.5;
    this.z = auto.z + Math.sin(auto.heading) * 1.5;
    this.avatar.group.visible = true;
    useCity.getState().setMode('foot');
  }

  private toggleDrone(): void {
    const city = useCity.getState();
    if (city.conversation || city.travel) return;
    if (city.mode === 'drone') {
      city.setMode(this.driving ? 'auto' : 'foot');
    } else {
      scratchEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.flyYaw = scratchEuler.y;
      this.flyPitch = scratchEuler.x;
      this.flyVelocity.set(0, 0, 0);
      city.setMode('drone');
    }
  }

  // ------------------------------------------------------------------ world

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private begin(index: WorldIndex): void {
    this.index = index;
    const city = useCity.getState();
    city.initWorld(index);
    const { positions } = useCity.getState();

    for (const parked of PARKED_AUTOS) {
      const home = autoHome(parked.id, positions);
      if (!home) continue;
      const group = this.kit.auto();
      const auto: Auto = { id: parked.id, group, x: home.x, z: home.z, heading: Math.PI / 2 };
      group.position.set(auto.x, 0, auto.z);
      group.rotation.y = auto.heading;
      this.actors.add(group);
      this.autos.push(auto);
    }
    for (const station of STATIONS) {
      const at = stationPosition(station, positions);
      if (!at) continue;
      const place = PLACE_NAMES[station.anchor] ?? '';
      const sign =
        station.kind === 'metro'
          ? this.kit.sign('#8a3fb0', 'Metro', place)
          : this.kit.sign('#2468b4', 'Bus stop', place);
      sign.position.set(at.x, 0, at.z);
      this.actors.add(sign);
      if (station.kind === 'bus') {
        // A bus waiting at every stop, and a row of them at the Majestic platforms.
        const count = station.anchor === 'majestic_bus' ? 5 : 1;
        for (let i = 0; i < count; i++) {
          const bus = this.kit.bus(i % 3 === 1 ? '#c23a2e' : '#2d6fb5');
          bus.position.set(at.x + 9 + i * 4.2, 0, at.z - 12);
          this.actors.add(bus);
        }
      }
    }
    // The title screen circles the spot where the game starts.
    this.camera.position.set(index.spawn.x + 300, 150, index.spawn.z + 300);
  }

  /** Puts everyone where the city's memory says they are right now. */
  private placeNpcs(): void {
    const city = useCity.getState();
    const context = contextOf(city);
    for (const npc of this.npcs) {
      const def = NPCS.find((entry) => entry.id === npc.id);
      const at = def ? npcPosition(def, context, city.positions) : null;
      npc.figure.group.visible = at !== null;
      if (at) npc.figure.group.position.set(at.x, 0, at.z);
    }
  }

  /** Building walls close enough to bump into. */
  private nearbyWalls(): THREE.Object3D[] {
    const size = this.index?.chunkSize ?? 250;
    const walls: THREE.Object3D[] = [];
    for (const chunk of this.streamer.root.children) {
      if (!(chunk instanceof THREE.Group)) continue;
      const dx = chunk.position.x + size / 2 - this.x;
      const dz = chunk.position.z + size / 2 - this.z;
      if (Math.abs(dx) > size || Math.abs(dz) > size) continue;
      for (const child of chunk.children) {
        if (child instanceof THREE.Mesh && child.material === this.materials.wall) {
          child.updateWorldMatrix(true, false);
          walls.push(child);
        }
      }
    }
    return walls;
  }

  /** True if moving by (dx, dz) from the player's position would run into a wall. */
  private blocked(dx: number, dz: number, radius: number): boolean {
    const length = Math.hypot(dx, dz);
    if (length < 1e-6 || this.walls.length === 0) return false;
    this.raycaster.set(scratch.set(this.x, 1, this.z), scratchB.set(dx / length, 0, dz / length));
    this.raycaster.far = length + radius;
    return this.raycaster.intersectObjects(this.walls, false).length > 0;
  }

  /** Moves the player, sliding along walls. Returns false if fully blocked. */
  private move(dx: number, dz: number, radius: number): boolean {
    if (!this.blocked(dx, dz, radius)) {
      this.x += dx;
      this.z += dz;
    } else if (Math.abs(dx) > 1e-4 && !this.blocked(dx, 0, radius)) this.x += dx;
    else if (Math.abs(dz) > 1e-4 && !this.blocked(0, dz, radius)) this.z += dz;
    else return false;
    const bounds = this.index?.bounds;
    if (bounds) {
      this.x = THREE.MathUtils.clamp(this.x, bounds.minX + 5, bounds.maxX - 5);
      this.z = THREE.MathUtils.clamp(this.z, bounds.minZ + 5, bounds.maxZ - 5);
    }
    return true;
  }

  // ------------------------------------------------------------------ simulation

  private walk(dt: number): void {
    if (this.held('ArrowLeft')) this.yaw += dt * 1.9;
    if (this.held('ArrowRight')) this.yaw -= dt * 1.9;
    const ahead = (this.held('KeyW', 'ArrowUp') ? 1 : 0) - (this.held('KeyS', 'ArrowDown') ? 1 : 0);
    const side = (this.held('KeyD') ? 1 : 0) - (this.held('KeyA') ? 1 : 0);
    let dx = -Math.sin(this.yaw) * ahead + Math.cos(this.yaw) * side;
    let dz = -Math.cos(this.yaw) * ahead - Math.sin(this.yaw) * side;
    const length = Math.hypot(dx, dz);
    const target = length > 0 ? (this.held('ShiftLeft', 'ShiftRight') ? RUN_SPEED : WALK_SPEED) : 0;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * 10));
    if (length > 0) {
      dx /= length;
      dz /= length;
      const wanted = Math.atan2(-dx, -dz);
      const turn = Math.atan2(Math.sin(wanted - this.heading), Math.cos(wanted - this.heading));
      this.heading += turn * (1 - Math.exp(-dt * 12));
      if (!this.move(dx * this.speed * dt, dz * this.speed * dt, PLAYER_RADIUS)) this.speed = 0;
    }
    this.stride += this.speed * dt * 2.1;
    const swing = Math.sin(this.stride) * Math.min(1, this.speed / WALK_SPEED) * 0.7;
    this.avatar.legs[0].rotation.x = swing;
    this.avatar.legs[1].rotation.x = -swing;
    this.avatar.arms[0].rotation.x = -swing * 0.8;
    this.avatar.arms[1].rotation.x = swing * 0.8;
  }

  private drive(dt: number, auto: Auto): void {
    const city = useCity.getState();
    const throttle =
      (this.held('KeyW', 'ArrowUp') ? 1 : 0) - (this.held('KeyS', 'ArrowDown') ? 1 : 0);
    const steer =
      (this.held('KeyA', 'ArrowLeft') ? 1 : 0) - (this.held('KeyD', 'ArrowRight') ? 1 : 0);
    const limit =
      AUTO_SPEED *
      speedFactor(useUi.getState().hour, city.raining, zoneAt(city.zones, this.x, this.z));
    this.speed += throttle * 13 * dt;
    this.speed *= Math.exp(-dt * (throttle === 0 ? 1.4 : 0.3));
    this.speed = THREE.MathUtils.clamp(this.speed, -AUTO_REVERSE, limit);
    this.heading += steer * dt * 2.1 * THREE.MathUtils.clamp(this.speed / 6, -1, 1);
    const step = this.speed * dt;
    if (!this.move(-Math.sin(this.heading) * step, -Math.cos(this.heading) * step, AUTO_RADIUS)) {
      this.speed *= -0.25; // bump
    }
    auto.x = this.x;
    auto.z = this.z;
    auto.heading = this.heading;
    auto.group.position.set(auto.x, 0, auto.z);
    auto.group.rotation.y = auto.heading;
    // The camera swings round behind the auto unless the player is steering it themselves.
    if (this.last - this.lastDrag > 1.5 && Math.abs(this.speed) > 1) {
      const turn = Math.atan2(Math.sin(this.heading - this.yaw), Math.cos(this.heading - this.yaw));
      this.yaw += turn * (1 - Math.exp(-dt * 2.2));
    }
  }

  private fly(dt: number): void {
    const camera = this.camera;
    scratchEuler.set(this.flyPitch, this.flyYaw, 0);
    camera.quaternion.setFromEuler(scratchEuler);
    camera.getWorldDirection(scratch);
    scratchB.crossVectors(scratch, UP).normalize();
    const move = new THREE.Vector3();
    if (this.held('KeyW', 'ArrowUp')) move.add(scratch);
    if (this.held('KeyS', 'ArrowDown')) move.sub(scratch);
    if (this.held('KeyD', 'ArrowRight')) move.add(scratchB);
    if (this.held('KeyA', 'ArrowLeft')) move.sub(scratchB);
    if (this.held('Space')) move.y += 1;
    if (this.held('KeyQ')) move.y -= 1;
    if (move.lengthSq() > 0) move.normalize();
    const speed = FLY_SPEED * (this.held('ShiftLeft', 'ShiftRight') ? 4 : 1);
    this.flyVelocity.lerp(move.multiplyScalar(speed), 1 - Math.exp(-dt * 6));
    camera.position.addScaledVector(this.flyVelocity, dt);
    const bounds = this.index?.bounds;
    if (bounds) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.minX, bounds.maxX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.minZ, bounds.maxZ);
    }
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 2.2, 700);
  }

  private follow(dt: number, snap: boolean): void {
    const height = this.driving ? 1.7 : 1.45;
    const reach = this.driving ? this.distance + 2.5 : this.distance;
    const flat = Math.cos(this.pitch) * reach;
    scratch.set(
      this.x + Math.sin(this.yaw) * flat,
      height + Math.sin(this.pitch) * reach,
      this.z + Math.cos(this.yaw) * flat,
    );
    if (snap) this.camera.position.copy(scratch);
    else this.camera.position.lerp(scratch, 1 - Math.exp(-dt * 12));
    this.camera.lookAt(this.x, height + 0.7, this.z);
  }

  private animateActors(dt: number, time: number): void {
    const city = useCity.getState();
    this.avatar.group.position.set(this.x, 0, this.z);
    this.avatar.group.rotation.y = this.heading + Math.PI;
    for (const npc of this.npcs) {
      const group = npc.figure.group;
      if (!group.visible) continue;
      const dx = this.x - group.position.x;
      const dz = this.z - group.position.z;
      const distance = Math.hypot(dx, dz);
      npc.label.visible = distance < 70;
      npc.marker.visible = distance < 120 && city.conversation?.npcId !== npc.id;
      npc.marker.rotation.y = time * 1.6 + npc.phase;
      npc.marker.position.y = 2.78 + Math.sin(time * 2 + npc.phase) * 0.06;
      // Idle sway; turn to face the player when they come close.
      const sway = Math.sin(time * 1.3 + npc.phase) * 0.05;
      npc.figure.arms[0].rotation.x = sway;
      npc.figure.arms[1].rotation.x = -sway;
      if (distance < 12 && distance > 0.3) {
        const wanted = Math.atan2(dx, dz);
        const turn = Math.atan2(
          Math.sin(wanted - group.rotation.y),
          Math.cos(wanted - group.rotation.y),
        );
        group.rotation.y += turn * (1 - Math.exp(-dt * 5));
      }
    }
    const tracker = trackerFor(city.missions, city.positions, city.player);
    const target = tracker?.target ?? null;
    this.beacon.visible = target !== null && useUi.getState().phase === 'playing';
    if (target) {
      this.beacon.position.set(target.x, 0, target.z);
      this.beacon.rotation.y = time * 0.4;
    }
    this.lamp.position.set(this.x, 4.5, this.z);
    this.lamp.intensity = (1 - this.atmosphere.day) * 60;
  }

  private nearestAuto(): { id: string; distance: number } | null {
    let found: { id: string; distance: number } | null = null;
    for (const auto of this.autos) {
      const distance = Math.hypot(auto.x - this.x, auto.z - this.z);
      if (distance < (found?.distance ?? AUTO_REACH)) found = { id: auto.id, distance };
    }
    return found;
  }

  private readonly frame = (millis: number): void => {
    if (this.disposed) return;
    const time = millis / 1000;
    const elapsed = Math.max(0, time - this.last);
    // Long frames are capped so a stall cannot fling the player through a wall.
    const dt = Math.min(0.1, elapsed);
    this.last = time;
    const ui = useUi.getState();
    let city = useCity.getState();

    if (!this.index && this.streamer.worldIndex) {
      this.begin(this.streamer.worldIndex);
      city = useCity.getState();
    }
    if (city.warp && city.warp.seq !== this.warpSeq) {
      this.warpSeq = city.warp.seq;
      if (this.driving) this.leaveAuto();
      this.x = city.warp.x;
      this.z = city.warp.z;
      this.speed = 0;
      this.wallTimer = 1;
      if (ui.phase === 'playing' && city.mode !== 'drone') this.follow(0, true);
    }
    if (city.interactSeq !== this.interactSeq) {
      this.interactSeq = city.interactSeq;
      if (ui.phase === 'playing') this.interact();
    }
    if (city.droneSeq !== this.droneSeq) {
      this.droneSeq = city.droneSeq;
      if (ui.phase === 'playing') this.toggleDrone();
    }

    const playing = ui.phase === 'playing' && this.index !== null;
    const busy = city.conversation !== null || city.travel !== null || city.panel !== null;

    if (playing) {
      this.clockTimer += dt;
      if (this.clockTimer >= 0.25) {
        city.tick(this.clockTimer);
        this.clockTimer = 0;
      }
      this.wallTimer += dt;
      if (this.wallTimer >= 0.4) {
        this.walls = this.nearbyWalls();
        this.wallTimer = 0;
      }
      if (busy) this.keys.clear();
      if (city.mode === 'drone') this.fly(dt);
      else {
        if (this.driving) this.drive(dt, this.driving);
        else this.walk(busy ? 0 : dt);
        this.follow(dt, false);
      }
      this.reportTimer += dt;
      if (this.reportTimer >= 0.2) {
        this.reportTimer = 0;
        city.report(this.x, this.z, this.driving ? null : this.nearestAuto());
      }
    } else if (ui.phase === 'title') {
      const centre = this.index?.spawn ?? { x: 0, z: 0 };
      const t = time * 0.035;
      this.camera.position.set(
        centre.x + Math.cos(t) * 430,
        150 + Math.sin(t * 1.7) * 25,
        centre.z + Math.sin(t) * 430,
      );
      this.camera.lookAt(centre.x, 10, centre.z);
    }

    this.placeTimer += dt;
    if (this.placeTimer >= 0.5 && this.index) {
      this.placeTimer = 0;
      this.placeNpcs();
    }
    this.animateActors(playing ? dt : 0, time);

    // Load the city around whatever the camera is looking at: the player, or the ground ahead of the drone.
    this.camera.getWorldDirection(scratch);
    const lead = Math.min(350, this.camera.position.y * 1.5);
    this.streamer.update(
      this.camera.position.x + scratch.x * lead,
      this.camera.position.z + scratch.z * lead,
    );
    this.atmosphere.update(this.camera, ui.hour, city.raining, dt);
    this.renderer.render(this.scene, this.camera);

    this.frames++;
    this.frameTime += elapsed;
    if (this.frameTime >= 0.5) {
      const info = this.renderer.info.render;
      ui.setPerf(Math.round(this.frames / this.frameTime), info.calls, info.triangles);
      this.frames = 0;
      this.frameTime = 0;
    }
  };

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizer.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('wheel', this.onWheel);
    this.scene.remove(this.streamer.root, this.actors, this.ground);
    this.streamer.dispose();
    this.atmosphere.dispose();
    this.kit.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.materials.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
