import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useUi } from '../state/ui';

const CAMERA_HEIGHT = 85;

/**
 * Prototype for the top-down (2.5D) direction: the same streamed city seen
 * from straight above with perspective, so buildings lean away from the
 * centre like the classic top-down open-world games. A placeholder auto
 * drives with WASD or the arrow keys. No collision yet: this exists to judge
 * the look, not the handling.
 */
export function TopDownDrive() {
  const phase = useUi((s) => s.phase);
  const camera = useThree((s) => s.camera);
  const auto = useRef<THREE.Group>(null);
  const keys = useRef(new Set<string>());
  const state = useRef({ x: 20, z: 60, heading: 0, speed: 0 });

  useEffect(() => {
    // Dev aid: ?at=x,z starts the auto at a given spot.
    const at = new URLSearchParams(window.location.search).get('at')?.split(',').map(Number);
    if (at && at.length === 2 && at.every(Number.isFinite)) {
      state.current.x = at[0] ?? 0;
      state.current.z = at[1] ?? 0;
    }
    const held = keys.current;
    const down = (event: KeyboardEvent) => held.add(event.code);
    const up = (event: KeyboardEvent) => held.delete(event.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const s = state.current;
    const held = keys.current;
    if (phase === 'playing') {
      const throttle =
        (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) -
        (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const steer =
        (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) -
        (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0);
      s.speed += throttle * 14 * dt;
      s.speed *= Math.exp(-dt * (throttle === 0 ? 1.4 : 0.35));
      s.speed = THREE.MathUtils.clamp(s.speed, -6, 17);
      s.heading += steer * dt * 2.2 * THREE.MathUtils.clamp(s.speed / 6, -1, 1);
      s.x -= Math.sin(s.heading) * s.speed * dt;
      s.z -= Math.cos(s.heading) * s.speed * dt;
    }
    if (auto.current) {
      auto.current.position.set(s.x, 0.15, s.z);
      auto.current.rotation.y = s.heading;
    }
    // Look slightly ahead of the auto so the player sees where they are going.
    const lead = s.speed * 0.9;
    const tx = s.x - Math.sin(s.heading) * lead;
    const tz = s.z - Math.cos(s.heading) * lead;
    camera.position.lerp(new THREE.Vector3(tx, CAMERA_HEIGHT, tz + 0.01), 1 - Math.exp(-dt * 4));
    camera.up.set(0, 0, -1);
    camera.lookAt(camera.position.x, 0, camera.position.z - 0.01);
  });

  return (
    <group ref={auto}>
      {/* Placeholder auto: green body, yellow canopy, seen from above. */}
      <mesh position={[0, 0.6, 0.1]} castShadow>
        <boxGeometry args={[1.35, 0.9, 2.5]} />
        <meshStandardMaterial color="#1f8a4c" />
      </mesh>
      <mesh position={[0, 1.3, 0.25]} castShadow>
        <boxGeometry args={[1.45, 0.5, 2.0]} />
        <meshStandardMaterial color="#f5c518" />
      </mesh>
      <mesh position={[0, 0.7, -1.3]}>
        <boxGeometry args={[0.7, 0.5, 0.5]} />
        <meshStandardMaterial color="#1f8a4c" />
      </mesh>
    </group>
  );
}
