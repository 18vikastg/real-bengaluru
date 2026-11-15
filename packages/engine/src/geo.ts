/** Geographic helpers: WGS84 to local metres (east = +x, south = +z). */
export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS = 6_378_137;
const DEG = Math.PI / 180;

/**
 * Equirectangular projection around an origin. Over a play area a few
 * kilometres wide the error is well under a metre, which is all we need.
 */
export function projectToLocal(point: LatLon, origin: LatLon): { x: number; z: number } {
  const x = (point.lon - origin.lon) * DEG * EARTH_RADIUS * Math.cos(origin.lat * DEG);
  const z = -(point.lat - origin.lat) * DEG * EARTH_RADIUS;
  return { x, z };
}

export function localToLatLon(x: number, z: number, origin: LatLon): LatLon {
  return {
    lat: origin.lat - z / (DEG * EARTH_RADIUS),
    lon: origin.lon + x / (DEG * EARTH_RADIUS * Math.cos(origin.lat * DEG)),
  };
}
