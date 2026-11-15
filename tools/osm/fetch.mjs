#!/usr/bin/env node
/**
 * Downloads raw OpenStreetMap data for the play area from the OSM API and
 * caches it under tools/osm/cache/ (git-ignored). Run rarely and politely:
 * tiles already on disk are never re-fetched.
 *
 *   node tools/osm/fetch.mjs
 *
 * Data © OpenStreetMap contributors, ODbL.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { BBOX, CACHE_DIR } from './config.mjs';

const API = 'https://api.openstreetmap.org/api/0.6/map.json';
const TILE = 0.005; // degrees; small enough to stay under the API's 50,000-node cap
const USER_AGENT = 'bengaluru-game-map-bake/0.1 (offline preprocessing, cached)';

mkdirSync(CACHE_DIR, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixed = (value) => value.toFixed(4);

async function fetchTile(west, south, east, north, depth = 0) {
  const name = `tile_${fixed(west)}_${fixed(south)}_${fixed(east)}_${fixed(north)}.json`;
  const file = new URL(name, CACHE_DIR);
  if (existsSync(file)) return 0;

  const url = `${API}?bbox=${fixed(west)},${fixed(south)},${fixed(east)},${fixed(north)}`;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
    if (response?.ok) {
      const text = await response.text();
      writeFileSync(file, text);
      console.log(`${name}  ${(text.length / 1024).toFixed(0)} kB`);
      await sleep(1000);
      return 1;
    }
    if (response?.status === 400 && depth < 3) {
      // Too many nodes: split into quadrants.
      const midLon = (west + east) / 2;
      const midLat = (south + north) / 2;
      return (
        (await fetchTile(west, south, midLon, midLat, depth + 1)) +
        (await fetchTile(midLon, south, east, midLat, depth + 1)) +
        (await fetchTile(west, midLat, midLon, north, depth + 1)) +
        (await fetchTile(midLon, midLat, east, north, depth + 1))
      );
    }
    if (attempt >= 4) throw new Error(`Failed ${url}: ${response?.status ?? 'network error'}`);
    await sleep(5000 * attempt);
  }
}

let fetched = 0;
for (let south = BBOX.south; south < BBOX.north - 1e-9; south += TILE) {
  for (let west = BBOX.west; west < BBOX.east - 1e-9; west += TILE) {
    fetched += await fetchTile(
      west,
      south,
      Math.min(west + TILE, BBOX.east),
      Math.min(south + TILE, BBOX.north),
    );
  }
}
console.log(`Done. ${fetched} tile(s) downloaded; the rest were cached.`);
