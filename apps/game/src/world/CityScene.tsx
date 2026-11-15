import { daylight, sunDirection } from '@blr/engine';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useUi } from '../state/ui';
import { ChunkStreamer } from './ChunkStreamer';
import { FlyCamera } from './FlyCamera';
import { TopDownDrive } from './TopDownDrive';
import type { WorldMaterials } from './materials';
import { createWorldMaterials } from './materials';

const NIGHT_SKY = new THREE.Color('#0b1020');
const DAY_SKY = new THREE.Color('#a9cfe8');
const DUSK_SKY = new THREE.Color('#f0a35e');
const SUN_WHITE = new THREE.Color('#fff4e0');
const SUN_WARM = new THREE.Color('#ff9a4a');
const MOON = new THREE.Color('#8fa6d8');
const SHADOW_RANGE = 220;

const scratchSun = { x: 0, y: 0, z: 0 };
const scratchForward = new THREE.Vector3();

/** Sun, sky colour, fog and window glow, driven by the time of day. The shadow box follows the camera. */
function Atmosphere({ materials }: { materials: WorldMaterials }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const fog = new THREE.Fog(sky, 420, 1050);
    fog.color = sky; // share the instance so fog always matches the sky
    scene.background = sky;
    scene.fog = fog;
    const light = sun.current;
    if (light) scene.add(light.target);
    return () => {
      scene.background = null;
      scene.fog = null;
      if (light) scene.remove(light.target);
    };
  }, [scene, sky]);

  useFrame(({ camera }) => {
    const hour = useUi.getState().hour;
    const direction = sunDirection(hour, scratchSun);
    const day = daylight(hour);
    // 1 near the horizon, 0 when the sun is high: drives the warm dusk tint.
    const lowSun = day * (1 - THREE.MathUtils.smoothstep(direction.y, 0.1, 0.55));
    sky
      .copy(NIGHT_SKY)
      .lerp(DAY_SKY, day)
      .lerp(DUSK_SKY, lowSun * 0.7);

    const light = sun.current;
    if (light) {
      // Centre the shadow box on the ground ahead of the camera, snapped to a grid to stop shimmer.
      camera.getWorldDirection(scratchForward);
      const reach = Math.min(160, camera.position.y * 1.2 + 40);
      const tx = Math.round((camera.position.x + scratchForward.x * reach) / 8) * 8;
      const tz = Math.round((camera.position.z + scratchForward.z * reach) / 8) * 8;
      // Below the horizon the same light stands in as a dim moon from the opposite side.
      const up = direction.y >= 0 ? 1 : -1;
      light.target.position.set(tx, 0, tz);
      light.position.set(
        tx + direction.x * 400 * up,
        Math.max(Math.abs(direction.y), 0.12) * 400,
        tz + direction.z * 400,
      );
      light.intensity = 0.25 + day * 3.1;
      if (day < 0.05) light.color.copy(MOON);
      else light.color.copy(SUN_WHITE).lerp(SUN_WARM, lowSun);
    }
    if (hemisphere.current) hemisphere.current.intensity = 0.3 + day * 1.1;
    materials.wall.emissiveIntensity = (1 - day) * 1.6;
  });

  return (
    <>
      <hemisphereLight ref={hemisphere} args={['#cfe4ff', '#6b5a48', 0.9]} />
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.25}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-SHADOW_RANGE, SHADOW_RANGE, SHADOW_RANGE, -SHADOW_RANGE, 10, 900]}
        />
      </directionalLight>
    </>
  );
}

/** Mounts the chunk streamer and keeps it centred on the camera. */
function World({ materials }: { materials: WorldMaterials }) {
  const scene = useThree((s) => s.scene);
  const streamer = useRef<ChunkStreamer | null>(null);

  useEffect(() => {
    const instance = new ChunkStreamer(`${import.meta.env.BASE_URL}world/`, materials, (status) =>
      useUi.getState().setWorld(status),
    );
    streamer.current = instance;
    scene.add(instance.root);
    return () => {
      scene.remove(instance.root);
      instance.dispose();
      streamer.current = null;
    };
  }, [scene, materials]);

  useFrame(({ camera }) => {
    // Load around the ground point the camera is looking towards, not directly below it.
    camera.getWorldDirection(scratchForward);
    const lead = Math.min(350, camera.position.y * 1.5);
    streamer.current?.update(
      camera.position.x + scratchForward.x * lead,
      camera.position.z + scratchForward.z * lead,
    );
  });

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[14000, 14000]} />
      <meshStandardMaterial color="#9c8f76" roughness={1} />
    </mesh>
  );
}

/** Publishes a smoothed frame rate and the last frame's draw-call and triangle counts to the HUD twice a second. */
function FrameRate() {
  const frames = useRef(0);
  const elapsed = useRef(0);
  useFrame(({ gl }, delta) => {
    frames.current++;
    elapsed.current += delta;
    if (elapsed.current >= 0.5) {
      useUi
        .getState()
        .setPerf(
          Math.round(frames.current / elapsed.current),
          gl.info.render.calls,
          gl.info.render.triangles,
        );
      frames.current = 0;
      elapsed.current = 0;
    }
  });
  return null;
}

function Scene({ topDown }: { topDown: boolean }) {
  const materials = useMemo(() => createWorldMaterials(), []);
  useEffect(() => () => materials.dispose(), [materials]);
  return (
    <>
      <Atmosphere materials={materials} />
      <World materials={materials} />
      {topDown ? <TopDownDrive /> : <FlyCamera />}
      <FrameRate />
    </>
  );
}

export function CityScene({ topDown = false }: { topDown?: boolean }) {
  return (
    <Canvas
      className="!absolute inset-0"
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 55, near: 1, far: 2600, position: [-150, 150, 320] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Scene topDown={topDown} />
    </Canvas>
  );
}
