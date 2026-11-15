import { daylight, sunDirection } from '@blr/engine';
import * as THREE from 'three';
import type { WorldMaterials } from '../world/materials';

const NIGHT_SKY = new THREE.Color('#0b1020');
const DAY_SKY = new THREE.Color('#a9cfe8');
const DUSK_SKY = new THREE.Color('#f0a35e');
const RAIN_SKY = new THREE.Color('#5d6873');
const SUN_WHITE = new THREE.Color('#fff4e0');
const SUN_WARM = new THREE.Color('#ff9a4a');
const MOON = new THREE.Color('#8fa6d8');
const SHADOW_RANGE = 220;
const RAIN_DROPS = 900;
const RAIN_BOX = 70;
const RAIN_HEIGHT = 42;

const scratchSun = { x: 0, y: 0, z: 0 };
const forward = new THREE.Vector3();

/**
 * Sun, sky colour, fog, window glow and rain, driven by the time of day and
 * the weather. The shadow box follows the camera.
 */
export class Atmosphere {
  private readonly sky = new THREE.Color();
  private readonly fog: THREE.Fog;
  private readonly sun = new THREE.DirectionalLight('#fff4e0', 3);
  private readonly hemisphere = new THREE.HemisphereLight('#cfe4ff', '#6b5a48', 0.9);
  private readonly rain: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  /** 0 dry to 1 pouring, eased so showers roll in rather than switch on. */
  private wet = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly materials: WorldMaterials,
  ) {
    this.fog = new THREE.Fog(this.sky, 420, 1050);
    this.fog.color = this.sky; // share the instance so fog always matches the sky
    scene.background = this.sky;
    scene.fog = this.fog;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.25;
    const shadow = this.sun.shadow.camera;
    shadow.left = -SHADOW_RANGE;
    shadow.right = SHADOW_RANGE;
    shadow.top = SHADOW_RANGE;
    shadow.bottom = -SHADOW_RANGE;
    shadow.near = 10;
    shadow.far = 900;
    shadow.updateProjectionMatrix();
    scene.add(this.sun, this.sun.target, this.hemisphere);

    this.rainPositions = new Float32Array(RAIN_DROPS * 6);
    for (let i = 0; i < RAIN_DROPS; i++) this.seedDrop(i, Math.random() * RAIN_HEIGHT);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: '#d6e4f0', transparent: true, opacity: 0.4 }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  /** Daylight right now, 0 to 1. Other lights use it to fade in at night. */
  get day(): number {
    return this.lastDay;
  }
  private lastDay = 1;

  private seedDrop(index: number, y: number): void {
    const x = (Math.random() - 0.5) * RAIN_BOX;
    const z = (Math.random() - 0.5) * RAIN_BOX;
    const p = this.rainPositions;
    p[index * 6] = x;
    p[index * 6 + 1] = y;
    p[index * 6 + 2] = z;
    p[index * 6 + 3] = x + 0.12;
    p[index * 6 + 4] = y + 1.1;
    p[index * 6 + 5] = z;
  }

  update(camera: THREE.Camera, hour: number, raining: boolean, dt: number): void {
    this.wet += ((raining ? 1 : 0) - this.wet) * (1 - Math.exp(-dt * 0.8));
    const wet = this.wet;
    const direction = sunDirection(hour, scratchSun);
    const day = daylight(hour);
    this.lastDay = day;
    // 1 near the horizon, 0 when the sun is high: drives the warm dusk tint.
    const lowSun = day * (1 - THREE.MathUtils.smoothstep(direction.y, 0.1, 0.55));
    this.sky
      .copy(NIGHT_SKY)
      .lerp(DAY_SKY, day)
      .lerp(DUSK_SKY, lowSun * 0.7 * (1 - wet))
      .lerp(RAIN_SKY, wet * (0.25 + day * 0.6));
    this.fog.near = 420 - wet * 330;
    this.fog.far = 1050 - wet * 560;

    // Centre the shadow box on the ground ahead of the camera, snapped to a grid to stop shimmer.
    camera.getWorldDirection(forward);
    const reach = Math.min(160, camera.position.y * 1.2 + 40);
    const tx = Math.round((camera.position.x + forward.x * reach) / 8) * 8;
    const tz = Math.round((camera.position.z + forward.z * reach) / 8) * 8;
    // Below the horizon the same light stands in as a dim moon from the opposite side.
    const up = direction.y >= 0 ? 1 : -1;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(
      tx + direction.x * 400 * up,
      Math.max(Math.abs(direction.y), 0.12) * 400,
      tz + direction.z * 400,
    );
    this.sun.intensity = (0.25 + day * 3.1) * (1 - wet * 0.6);
    if (day < 0.05) this.sun.color.copy(MOON);
    else this.sun.color.copy(SUN_WHITE).lerp(SUN_WARM, lowSun);
    this.hemisphere.intensity = (0.3 + day * 1.1) * (1 - wet * 0.25);
    this.materials.wall.emissiveIntensity = (1 - day) * 1.6 + wet * day * 0.5;

    this.rain.visible = wet > 0.03;
    if (this.rain.visible) {
      (this.rain.material as THREE.LineBasicMaterial).opacity = 0.42 * wet;
      this.rain.position.set(
        camera.position.x,
        Math.max(0, camera.position.y - 14),
        camera.position.z,
      );
      const fall = 34 * dt;
      const p = this.rainPositions;
      for (let i = 0; i < RAIN_DROPS; i++) {
        const y = (p[i * 6 + 1] as number) - fall;
        if (y < 0) this.seedDrop(i, RAIN_HEIGHT);
        else {
          p[i * 6 + 1] = y;
          p[i * 6 + 4] = y + 1.1;
        }
      }
      (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose(): void {
    this.scene.remove(this.sun, this.sun.target, this.hemisphere, this.rain);
    this.scene.background = null;
    this.scene.fog = null;
    this.sun.shadow.map?.dispose();
    this.rain.geometry.dispose();
    (this.rain.material as THREE.Material).dispose();
  }
}
