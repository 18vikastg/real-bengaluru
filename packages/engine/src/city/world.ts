/**
 * The city's clock, weather and traffic. All of it is deterministic given
 * the inputs, so missions can be simulated in tests.
 */
import { createRng } from '../random';

/** Game seconds that pass per real second while playing. */
export const CLOCK_RATE = 10;

export function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

/** Advances a clock hour by real seconds at the game's clock rate. */
export function advanceHour(hour: number, realSeconds: number, rate = CLOCK_RATE): number {
  return wrapHour(hour + (realSeconds * rate) / 3600);
}

/** Hours from `from` until `to` going forwards around the clock (0 to 24). */
export function hoursUntil(from: number, to: number): number {
  return wrapHour(to - from);
}

export function formatClock(hour: number): string {
  const total = Math.round(wrapHour(hour) * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  return `${Math.floor(whole / 60)} h ${String(whole % 60).padStart(2, '0')} min`;
}

export type DayPart = 'early' | 'morning' | 'afternoon' | 'evening' | 'night';

export function dayPart(hour: number): DayPart {
  const h = wrapHour(hour);
  if (h < 5) return 'night';
  if (h < 8) return 'early';
  if (h < 12) return 'morning';
  if (h < 16.5) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

/**
 * How jammed the roads are, 0 (empty) to 1 (peak). Two humps: the office
 * rush around 9 and the longer evening crawl around 18:30.
 */
export function congestion(hour: number): number {
  const h = wrapHour(hour);
  const hump = (centre: number, width: number) => Math.exp(-(((h - centre) / width) ** 2));
  const base = h > 6 && h < 22.5 ? 0.22 : 0.03;
  return Math.min(1, base + 0.78 * Math.max(hump(9.2, 1.1), hump(18.6, 1.5)));
}

export interface TrafficZone {
  x: number;
  z: number;
  radius: number;
  /** 0 to 1: how much worse than the rest of town this junction is. */
  severity: number;
  name: string;
}

/** The jam zone the point is inside, if any (the worst one when they overlap). */
export function zoneAt(zones: readonly TrafficZone[], x: number, z: number): TrafficZone | null {
  let worst: TrafficZone | null = null;
  for (const zone of zones) {
    if (Math.hypot(zone.x - x, zone.z - z) > zone.radius) continue;
    if (!worst || zone.severity > worst.severity) worst = zone;
  }
  return worst;
}

/**
 * Multiplier on a vehicle's top speed at a point: 1 on a clear road, down to
 * about a quarter in a peak-hour jam in the rain.
 */
export function speedFactor(
  hour: number,
  raining: boolean,
  zone: TrafficZone | null = null,
): number {
  const jam = congestion(hour) * (0.45 + (zone ? zone.severity * 0.55 : 0));
  const factor = (1 - 0.72 * jam) * (raining ? 0.78 : 1);
  return Math.max(0.22, Math.min(1, factor));
}

/** Average door-to-door speed of city traffic in metres per second. */
export function cruiseSpeed(hour: number, raining: boolean): number {
  return 9.5 * speedFactor(hour, raining, { x: 0, z: 0, radius: 0, severity: 0.5, name: '' });
}

/** Minutes a road trip of `metres` (as the crow flies) takes right now. */
export function driveMinutes(metres: number, hour: number, raining: boolean): number {
  const roadMetres = metres * 1.3; // streets are never straight
  return Math.max(2, roadMetres / cruiseSpeed(hour, raining) / 60);
}

export interface Weather {
  raining: boolean;
  /** Clock hour when the current spell (wet or dry) is next reconsidered. */
  until: number;
}

/**
 * The evening shower: on most days it rains for a while somewhere between
 * 16:00 and 20:00, and occasionally at night. Deterministic per day.
 */
export function showerFor(day: number): { from: number; to: number } | null {
  const rng = createRng(0xb1a2 + day * 7919);
  if (rng() > 0.7) return null;
  const from = 15.5 + rng() * 4;
  return { from, to: from + 0.6 + rng() * 1.4 };
}

export function isRainingAt(day: number, hour: number): boolean {
  const shower = showerFor(day);
  if (!shower) return false;
  const h = wrapHour(hour);
  return h >= shower.from && h < shower.to;
}
