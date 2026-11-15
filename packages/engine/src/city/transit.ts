/**
 * Scheduled transport: metro and bus lines running on a fixed headway.
 * Timings are game timings, tuned to feel right; they are not a real timetable.
 */
import { congestion, wrapHour } from './world';

export interface TransitLine {
  id: string;
  name: string;
  kind: 'metro' | 'bus';
  /** Anchor ids of the stops, in order. Trains and buses run both ways. */
  stops: readonly string[];
  /** Minutes between departures. */
  headway: number;
  /** Minutes between neighbouring stops on a clear run. */
  minutesPerStop: number;
  firstHour: number;
  lastHour: number;
  baseFare: number;
  farePerStop: number;
}

export interface TransitTrip {
  line: TransitLine;
  from: string;
  to: string;
  stops: number;
  /** Minutes until the next departure. */
  wait: number;
  /** Minutes on board. */
  ride: number;
  fare: number;
  /** Clock hour of arrival. */
  arrival: number;
}

export function isRunning(line: TransitLine, hour: number): boolean {
  const h = wrapHour(hour);
  return h >= line.firstHour && h <= line.lastHour;
}

/** Minutes until the next departure from a stop. Each stop has its own fixed offset. */
export function minutesToNextDeparture(line: TransitLine, stop: string, hour: number): number {
  const index = Math.max(0, line.stops.indexOf(stop));
  const offset = (index * 2.5) % line.headway;
  const minutes = wrapHour(hour) * 60;
  const sinceLast = (((minutes - offset) % line.headway) + line.headway) % line.headway;
  const wait = line.headway - sinceLast;
  return wait >= line.headway - 1e-6 ? 0 : wait;
}

export function planTrip(
  line: TransitLine,
  from: string,
  to: string,
  hour: number,
  raining: boolean,
): TransitTrip | null {
  const a = line.stops.indexOf(from);
  const b = line.stops.indexOf(to);
  if (a < 0 || b < 0 || a === b || !isRunning(line, hour)) return null;
  const stops = Math.abs(a - b);
  const wait = minutesToNextDeparture(line, from, hour);
  // Buses sit in the same traffic as everyone else; the metro does not care.
  const slow = line.kind === 'bus' ? 1 + congestion(hour) * 1.1 + (raining ? 0.25 : 0) : 1;
  const ride = stops * line.minutesPerStop * slow;
  return {
    line,
    from,
    to,
    stops,
    wait,
    ride,
    fare: line.baseFare + line.farePerStop * (stops - 1),
    arrival: wrapHour(hour + (wait + ride) / 60),
  };
}
