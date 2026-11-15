/**
 * Chapter 1 play area: Majestic to MG Road. West to east it takes in the
 * Majestic bus stand and city railway station, KR Market, Vidhana Soudha,
 * Cubbon Park, MG Road, Church Street, Brigade Road and Trinity Circle.
 * The origin is the centre of the box; game coordinates are metres east (+x)
 * and south (+z) of it.
 */
export const BBOX = { south: 12.96, west: 77.565, north: 12.988, east: 77.622 };
export const ORIGIN = {
  lat: (BBOX.south + BBOX.north) / 2,
  lon: (BBOX.west + BBOX.east) / 2,
};
export const CHUNK_SIZE = 250;
export const CACHE_DIR = new URL('./cache/', import.meta.url);
export const OUTPUT_DIR = new URL('../../apps/game/public/world/', import.meta.url);
