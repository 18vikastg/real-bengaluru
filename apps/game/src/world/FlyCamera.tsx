import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useUi } from '../state/ui';

const BASE_SPEED = 45;
const FAST_MULTIPLIER = 4;
const MIN_HEIGHT = 2.2;
const MAX_HEIGHT = 700;
const LIMIT = 2600;

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const move = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const look = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Title screen: a slow drone orbit over the neighbourhood.
 * Playing: free flight. WASD or arrows to move, drag to look, Q/E to
 * descend/climb, Shift to go faster, scroll to dolly.
 */
export function FlyCamera() {
  const phase = useUi((s) => s.phase);
  const camera = useThree((s) => s.camera);
  const element = useThree((s) => s.gl.domElement);
  const keys = useRef(new Set<string>());
  const yaw = useRef(0);
  const pitch = useRef(-0.45);
  const dolly = useRef(0);
  const velocity = useRef(new THREE.Vector3());

  useEffect(() => {
    if (phase === 'title') return;
    // Dev aid: ?cam=x,y,z,yawDeg,pitchDeg starts from an exact pose (used for screenshots and captures).
    const pose = new URLSearchParams(window.location.search).get('cam')?.split(',').map(Number);
    if (pose && pose.length === 5 && pose.every(Number.isFinite)) {
      const [x = 0, y = 0, z = 0, yawDeg = 0, pitchDeg = 0] = pose;
      camera.position.set(x, y, z);
      look.set(THREE.MathUtils.degToRad(pitchDeg), THREE.MathUtils.degToRad(yawDeg), 0);
      camera.quaternion.setFromEuler(look);
    }
    // Take over from wherever the camera is now (the title orbit, or the pose above).
    look.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = look.y;
    pitch.current = look.x;
  }, [phase, camera]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const held = keys.current;
    let dragging = false;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      held.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => held.delete(event.code);
    const onBlur = () => held.clear();
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      element.setPointerCapture(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= event.movementX * 0.0032;
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0032, -1.5, 1.2);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      dolly.current -= event.deltaY * 0.25;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      held.clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('wheel', onWheel);
    };
  }, [phase, element]);

  useFrame(({ clock }, delta) => {
    if (phase === 'title') {
      const t = clock.elapsedTime * 0.035;
      camera.position.set(Math.cos(t) * 430, 150 + Math.sin(t * 1.7) * 25, Math.sin(t) * 430);
      camera.lookAt(0, 10, 0);
      return;
    }
    if (phase !== 'playing') return;

    const dt = Math.min(delta, 0.1);
    const held = keys.current;
    look.set(pitch.current, yaw.current, 0);
    camera.quaternion.setFromEuler(look);
    camera.getWorldDirection(forward);
    right.crossVectors(forward, UP).normalize();

    move.set(0, 0, 0);
    if (held.has('KeyW') || held.has('ArrowUp')) move.add(forward);
    if (held.has('KeyS') || held.has('ArrowDown')) move.sub(forward);
    if (held.has('KeyD') || held.has('ArrowRight')) move.add(right);
    if (held.has('KeyA') || held.has('ArrowLeft')) move.sub(right);
    if (held.has('KeyE') || held.has('Space')) move.y += 1;
    if (held.has('KeyQ')) move.y -= 1;
    if (move.lengthSq() > 0) move.normalize();
    const speed =
      BASE_SPEED * (held.has('ShiftLeft') || held.has('ShiftRight') ? FAST_MULTIPLIER : 1);
    // Ease towards the target velocity so starts and stops feel weighty, not instant.
    velocity.current.lerp(move.multiplyScalar(speed), 1 - Math.exp(-dt * 6));
    camera.position.addScaledVector(velocity.current, dt);

    if (Math.abs(dolly.current) > 0.01) {
      const step = dolly.current * (1 - Math.exp(-dt * 10));
      camera.position.addScaledVector(forward, step);
      dolly.current -= step;
    }

    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -LIMIT, LIMIT);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -LIMIT, LIMIT);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, MIN_HEIGHT, MAX_HEIGHT);
  });

  return null;
}
