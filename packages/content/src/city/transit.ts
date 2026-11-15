import type { TransitLine } from '@blr/engine';

/**
 * Lines through the play area. Stop order follows the real city; headways,
 * journey times and fares are game values, not a published timetable.
 */
export const TRANSIT_LINES: readonly TransitLine[] = [
  {
    id: 'purple',
    name: 'Namma Metro · Purple Line',
    kind: 'metro',
    stops: ['majestic_metro', 'vidhana_soudha', 'cubbon_metro', 'mg_road_metro', 'trinity'],
    headway: 6,
    minutesPerStop: 2.5,
    firstHour: 5,
    lastHour: 23,
    baseFare: 10,
    farePerStop: 5,
  },
  {
    id: 'bus_east',
    name: 'BMTC · Majestic to MG Road',
    kind: 'bus',
    stops: ['majestic_bus', 'kg_road', 'hudson_circle', 'kasturba_road', 'mg_road_auto', 'trinity'],
    headway: 12,
    minutesPerStop: 4,
    firstHour: 5.5,
    lastHour: 22.5,
    baseFare: 10,
    farePerStop: 3,
  },
  {
    id: 'bus_market',
    name: 'BMTC · Majestic to KR Market',
    kind: 'bus',
    stops: ['majestic_bus', 'kr_market', 'town_hall', 'hudson_circle'],
    headway: 10,
    minutesPerStop: 4,
    firstHour: 5.5,
    lastHour: 22.5,
    baseFare: 10,
    farePerStop: 3,
  },
];

export interface Station {
  id: string;
  anchor: string;
  kind: 'metro' | 'bus';
  lines: readonly TransitLine[];
}

/** One station per stop anchor and kind, serving every line that calls there. */
export const STATIONS: readonly Station[] = (() => {
  const byKey = new Map<string, { anchor: string; kind: 'metro' | 'bus'; lines: TransitLine[] }>();
  for (const line of TRANSIT_LINES) {
    for (const anchor of line.stops) {
      const key = `${line.kind}:${anchor}`;
      const station = byKey.get(key);
      if (station) station.lines.push(line);
      else byKey.set(key, { anchor, kind: line.kind, lines: [line] });
    }
  }
  return [...byKey.entries()].map(([id, station]) => ({ id, ...station }));
})();

/** Junctions that jam worse than the rest of town. Severity is 0 to 1. */
export const TRAFFIC_HOTSPOTS: readonly {
  anchor: string;
  radius: number;
  severity: number;
}[] = [
  { anchor: 'hudson_circle', radius: 170, severity: 1 },
  { anchor: 'kr_market', radius: 180, severity: 0.95 },
  { anchor: 'kg_road', radius: 200, severity: 0.85 },
  { anchor: 'majestic_auto', radius: 190, severity: 0.75 },
  { anchor: 'mg_road_auto', radius: 220, severity: 0.7 },
  { anchor: 'kasturba_road', radius: 180, severity: 0.6 },
  { anchor: 'trinity', radius: 160, severity: 0.6 },
];

/** Autos left at the kerb that the player can drive off in. Offsets are metres east and south. */
export const PARKED_AUTOS: readonly {
  id: string;
  anchor: string;
  offset: readonly [number, number];
}[] = [
  { id: 'auto_majestic', anchor: 'majestic_bus', offset: [9, 7] },
  { id: 'auto_kg', anchor: 'kg_road', offset: [7, 4] },
  { id: 'auto_market', anchor: 'kr_market', offset: [7, -4] },
  { id: 'auto_hudson', anchor: 'hudson_circle', offset: [-7, 5] },
  { id: 'auto_cubbon', anchor: 'kasturba_road', offset: [6, 5] },
  { id: 'auto_church', anchor: 'church_street', offset: [9, 4] },
  { id: 'auto_trinity', anchor: 'trinity', offset: [6, 5] },
];
