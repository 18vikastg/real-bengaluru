/**
 * Stylised sun direction for a given local hour. Not astronomically exact:
 * sunrise at 06:00, sunset at 18:00, tilted south like Bengaluru's low
 * latitude. Returns a unit vector pointing from the world towards the sun
 * (x = east, y = up, z = south).
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function sunDirection(hour: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const h = ((hour % 24) + 24) % 24;
  const angle = ((h - 6) / 12) * Math.PI; // 0 at sunrise, PI at sunset
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  const z = 0.5;
  const length = Math.hypot(x, y, z);
  out.x = x / length;
  out.y = y / length;
  out.z = z / length;
  return out;
}

/** 0 at night, 1 at full day, smooth through dawn and dusk. */
export function daylight(hour: number): number {
  const elevation = sunDirection(hour).y;
  const t = Math.min(1, Math.max(0, (elevation + 0.1) / 0.35));
  return t * t * (3 - 2 * t);
}
