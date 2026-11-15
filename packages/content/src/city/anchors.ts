/**
 * Named spots in the real city that characters, missions and the guide hang
 * off. Coordinates are approximate WGS84; the map bake snaps each one to the
 * nearest open ground (kind "foot") or road surface (kind "road") and writes
 * the result into the world index, so nobody ends up inside a wall.
 */
export interface Anchor {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: 'foot' | 'road';
}

export const ANCHORS = [
  { id: 'majestic_bus', name: 'Majestic bus stand', lat: 12.9774, lon: 77.5727, kind: 'foot' },
  { id: 'majestic_auto', name: 'Majestic auto stand', lat: 12.9768, lon: 77.5733, kind: 'road' },
  { id: 'majestic_metro', name: 'Majestic metro', lat: 12.9757, lon: 77.5729, kind: 'foot' },
  { id: 'ksr_station', name: 'City railway station', lat: 12.9781, lon: 77.5706, kind: 'foot' },
  { id: 'anand_rao', name: 'Anand Rao Circle', lat: 12.9799, lon: 77.5768, kind: 'foot' },
  { id: 'kg_road', name: 'KG Road', lat: 12.9749, lon: 77.5793, kind: 'foot' },
  { id: 'kr_market', name: 'KR Market', lat: 12.9647, lon: 77.5772, kind: 'foot' },
  { id: 'town_hall', name: 'Town Hall', lat: 12.9638, lon: 77.5858, kind: 'foot' },
  { id: 'hudson_circle', name: 'Hudson Circle', lat: 12.9667, lon: 77.5872, kind: 'foot' },
  { id: 'vidhana_soudha', name: 'Vidhana Soudha', lat: 12.9794, lon: 77.5918, kind: 'foot' },
  { id: 'cubbon_park', name: 'Cubbon Park', lat: 12.9763, lon: 77.593, kind: 'foot' },
  { id: 'cubbon_metro', name: 'Cubbon Park metro', lat: 12.9809, lon: 77.5975, kind: 'foot' },
  { id: 'kasturba_road', name: 'Kasturba Road', lat: 12.9752, lon: 77.5964, kind: 'foot' },
  { id: 'ub_city', name: 'Vittal Mallya Road', lat: 12.9716, lon: 77.596, kind: 'foot' },
  { id: 'chinnaswamy', name: 'Chinnaswamy Stadium', lat: 12.9788, lon: 77.5996, kind: 'foot' },
  { id: 'mg_road_metro', name: 'MG Road metro', lat: 12.9755, lon: 77.6068, kind: 'foot' },
  { id: 'mg_road_auto', name: 'MG Road auto stand', lat: 12.9753, lon: 77.6058, kind: 'road' },
  { id: 'church_street', name: 'Church Street', lat: 12.975, lon: 77.6045, kind: 'foot' },
  { id: 'brigade_road', name: 'Brigade Road', lat: 12.9727, lon: 77.6072, kind: 'foot' },
  { id: 'commercial_street', name: 'Commercial Street', lat: 12.9822, lon: 77.608, kind: 'foot' },
  { id: 'trinity', name: 'Trinity Circle', lat: 12.973, lon: 77.617, kind: 'foot' },
] as const satisfies readonly Anchor[];

export type AnchorId = (typeof ANCHORS)[number]['id'];
