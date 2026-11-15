#!/usr/bin/env node
/**
 * Writes a PLACEHOLDER extract for the play area, in the same JSON shape the
 * OpenStreetMap API returns, so the game is playable before the real map has
 * been fetched. Main roads, parks and landmarks are placed by hand at roughly
 * their real positions; side streets and ordinary buildings are generated.
 * It is a sketch of the city, not a map of it.
 *
 *   pnpm world:sketch   # this, then bake --sketch
 *
 * Replace it with the real thing: pnpm world:fetch && pnpm world:bake
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { BBOX, ORIGIN, SKETCH_DIR } from './config.mjs';

const DEG = Math.PI / 180;
const R = 6_378_137;
const toLocal = ([lat, lon]) => ({
  x: (lon - ORIGIN.lon) * DEG * R * Math.cos(ORIGIN.lat * DEG),
  z: -(lat - ORIGIN.lat) * DEG * R,
});
const toLatLon = ({ x, z }) => ({
  lat: ORIGIN.lat - z / (DEG * R),
  lon: ORIGIN.lon + x / (DEG * R * Math.cos(ORIGIN.lat * DEG)),
});

function mulberry(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry(560001);

// ------------------------------------------------------------ element store

const elements = [];
let nextId = 1;
function addNode(point, tags) {
  const id = nextId++;
  const { lat, lon } = toLatLon(point);
  elements.push({
    type: 'node',
    id,
    lat: +lat.toFixed(7),
    lon: +lon.toFixed(7),
    ...(tags && { tags }),
  });
  return id;
}
function addWay(points, tags, closed = false) {
  const nodes = points.map((point) => addNode(point));
  if (closed) nodes.push(nodes[0]);
  elements.push({ type: 'way', id: nextId++, nodes, tags });
}

// ------------------------------------------------------------ hand-placed city

/** Main roads: [name, highway class, half-width in metres, points as lat/lon, options]. */
const ROADS = [
  [
    'Gubbi Thotadappa Road',
    'secondary',
    5,
    [
      [12.9812, 77.5712],
      [12.9781, 77.5713],
      [12.9752, 77.5716],
      [12.9722, 77.5722],
      [12.969, 77.573],
    ],
  ],
  [
    'Platform Road',
    'secondary',
    5,
    [
      [12.9812, 77.5712],
      [12.984, 77.572],
      [12.9872, 77.5735],
    ],
  ],
  [
    'Dhanvanthri Road',
    'secondary',
    5,
    [
      [12.9805, 77.5745],
      [12.977, 77.5744],
      [12.9752, 77.5742],
    ],
  ],
  [
    'Subedar Chatram Road',
    'secondary',
    5,
    [
      [12.9799, 77.5768],
      [12.9803, 77.5755],
      [12.9805, 77.5745],
      [12.9812, 77.5712],
    ],
  ],
  [
    'Kempegowda Road',
    'primary',
    6,
    [
      [12.9752, 77.5716],
      [12.9752, 77.5742],
      [12.975, 77.577],
      [12.9748, 77.5797],
      [12.9735, 77.5822],
      [12.9712, 77.5845],
      [12.969, 77.586],
      [12.9667, 77.5872],
    ],
  ],
  [
    'Seshadri Road',
    'primary',
    6,
    [
      [12.9799, 77.5768],
      [12.9785, 77.58],
      [12.9765, 77.5835],
      [12.9756, 77.5856],
    ],
  ],
  [
    'Race Course Road',
    'secondary',
    5,
    [
      [12.9799, 77.5768],
      [12.983, 77.58],
      [12.9872, 77.5832],
    ],
  ],
  [
    'Avenue Road',
    'tertiary',
    4,
    [
      [12.9748, 77.5797],
      [12.9715, 77.5788],
      [12.968, 77.578],
      [12.965, 77.5775],
    ],
  ],
  [
    'Narasimharaja Road',
    'primary',
    6,
    [
      [12.965, 77.5775],
      [12.964, 77.5815],
      [12.9637, 77.5855],
      [12.965, 77.5868],
      [12.9667, 77.5872],
    ],
  ],
  [
    'Mysore Road',
    'primary',
    6,
    [
      [12.965, 77.5775],
      [12.964, 77.573],
      [12.9632, 77.5662],
    ],
  ],
  [
    'J C Road',
    'primary',
    6,
    [
      [12.9637, 77.5855],
      [12.9605, 77.5845],
    ],
  ],
  [
    'Nrupathunga Road',
    'primary',
    6,
    [
      [12.9756, 77.5856],
      [12.9712, 77.5866],
      [12.9667, 77.5872],
    ],
  ],
  [
    'Ambedkar Veedhi',
    'primary',
    6,
    [
      [12.9756, 77.5856],
      [12.976, 77.5895],
      [12.9775, 77.5915],
      [12.98, 77.5918],
      [12.9825, 77.5915],
    ],
  ],
  [
    'Raj Bhavan Road',
    'primary',
    6,
    [
      [12.9825, 77.5915],
      [12.9818, 77.595],
      [12.9809, 77.5975],
    ],
  ],
  [
    'Cubbon Road',
    'primary',
    6,
    [
      [12.9809, 77.5975],
      [12.98, 77.602],
      [12.979, 77.608],
      [12.9778, 77.614],
      [12.9762, 77.62],
    ],
  ],
  [
    'Infantry Road',
    'secondary',
    5,
    [
      [12.9825, 77.5915],
      [12.9835, 77.598],
      [12.9845, 77.605],
      [12.985, 77.608],
    ],
  ],
  [
    'Queens Road',
    'secondary',
    5,
    [
      [12.9765, 77.5992],
      [12.979, 77.5982],
      [12.9809, 77.5975],
      [12.984, 77.599],
      [12.9875, 77.6],
    ],
  ],
  [
    'Kasturba Road',
    'primary',
    6,
    [
      [12.9667, 77.5872],
      [12.969, 77.5905],
      [12.9716, 77.5949],
      [12.9745, 77.5972],
      [12.9765, 77.5992],
    ],
  ],
  [
    'Mahatma Gandhi Road',
    'primary',
    8,
    [
      [12.9765, 77.5992],
      [12.976, 77.603],
      [12.9756, 77.6068],
      [12.975, 77.611],
      [12.974, 77.615],
      [12.973, 77.619],
      [12.9722, 77.6217],
    ],
  ],
  [
    'Church Street',
    'residential',
    3,
    [
      [12.9752, 77.6012],
      [12.9748, 77.6045],
      [12.9745, 77.6075],
    ],
  ],
  [
    'St. Mark’s Road',
    'secondary',
    5,
    [
      [12.9762, 77.601],
      [12.9752, 77.6012],
      [12.9725, 77.6008],
      [12.97, 77.6003],
    ],
  ],
  [
    'Brigade Road',
    'secondary',
    5,
    [
      [12.9756, 77.6075],
      [12.9745, 77.6075],
      [12.9727, 77.6072],
      [12.9705, 77.6068],
    ],
  ],
  [
    'Residency Road',
    'primary',
    6,
    [
      [12.9662, 77.596],
      [12.9685, 77.601],
      [12.9705, 77.6068],
      [12.9728, 77.6098],
      [12.975, 77.611],
    ],
  ],
  [
    'Vittal Mallya Road',
    'secondary',
    5,
    [
      [12.9716, 77.5949],
      [12.971, 77.5975],
      [12.97, 77.6003],
    ],
  ],
  [
    'Richmond Road',
    'primary',
    6,
    [
      [12.9667, 77.5872],
      [12.9655, 77.592],
      [12.9662, 77.596],
      [12.966, 77.604],
      [12.9655, 77.611],
      [12.965, 77.618],
    ],
  ],
  [
    'Kamaraj Road',
    'secondary',
    5,
    [
      [12.9756, 77.6085],
      [12.979, 77.6085],
      [12.9822, 77.6083],
      [12.985, 77.608],
    ],
  ],
  [
    'Commercial Street',
    'tertiary',
    4,
    [
      [12.9822, 77.6055],
      [12.9822, 77.6083],
      [12.9822, 77.611],
    ],
  ],
  [
    'Ulsoor Road',
    'secondary',
    5,
    [
      [12.973, 77.619],
      [12.9762, 77.62],
      [12.98, 77.6168],
    ],
  ],
  [
    'Cubbon Park Road',
    'tertiary',
    4,
    [
      [12.976, 77.5895],
      [12.9763, 77.593],
      [12.9745, 77.5972],
    ],
    { bare: true },
  ],
  [
    'Bus Stand Road',
    'service',
    3,
    [
      [12.9786, 77.572],
      [12.9786, 77.5738],
      [12.9764, 77.5738],
      [12.9764, 77.572],
      [12.9786, 77.572],
    ],
    { bare: true },
  ],
  [
    'Platform 1',
    'service',
    3,
    [
      [12.978, 77.5721],
      [12.978, 77.5737],
    ],
    { bare: true },
  ],
  [
    'Platform 2',
    'service',
    3,
    [
      [12.9774, 77.5721],
      [12.9774, 77.5737],
    ],
    { bare: true },
  ],
  [
    'Platform 3',
    'service',
    3,
    [
      [12.9769, 77.5721],
      [12.9769, 77.5737],
    ],
    { bare: true },
  ],
];

/** Open spaces: [tags, ring as lat/lon]. Nothing is built or laned inside these. */
const AREAS = [
  [
    { leisure: 'park', name: 'Cubbon Park' },
    [
      [12.9806, 77.5924],
      [12.9806, 77.597],
      [12.9768, 77.5987],
      [12.9722, 77.5952],
      [12.97, 77.5912],
      [12.9742, 77.5872],
      [12.9768, 77.5912],
    ],
  ],
  [
    { leisure: 'park', name: 'Freedom Park' },
    [
      [12.979, 77.5802],
      [12.979, 77.5822],
      [12.9772, 77.5826],
      [12.9772, 77.5806],
    ],
  ],
  [
    { landuse: 'grass', name: 'Race Course' },
    [
      [12.9872, 77.5778],
      [12.9872, 77.5858],
      [12.9822, 77.5858],
      [12.9812, 77.5795],
    ],
  ],
  [
    { landuse: 'grass', name: 'Raj Bhavan' },
    [
      [12.9862, 77.5895],
      [12.9862, 77.5945],
      [12.9834, 77.5945],
      [12.9834, 77.5895],
    ],
  ],
  [
    { landuse: 'grass', name: 'Parade Ground' },
    [
      [12.9788, 77.6094],
      [12.9782, 77.6132],
      [12.9762, 77.6128],
      [12.9764, 77.6094],
    ],
  ],
  [
    { natural: 'water', name: 'Ulsoor Lake' },
    [
      [12.9872, 77.6172],
      [12.9872, 77.6215],
      [12.9815, 77.6215],
      [12.9808, 77.6185],
      [12.984, 77.6168],
    ],
  ],
];

/** Keep-outs that are not drawn as areas: [name, ring as lat/lon]. */
const COMPOUNDS = [
  [
    'Vidhana Soudha compound',
    [
      [12.981, 77.5892],
      [12.981, 77.5914],
      [12.9776, 77.5912],
      [12.9772, 77.5893],
    ],
  ],
  [
    'Railway yard',
    [
      [12.9872, 77.565],
      [12.9872, 77.5708],
      [12.9812, 77.5708],
      [12.97, 77.5712],
      [12.97, 77.565],
    ],
  ],
  [
    'Bus stand',
    [
      [12.979, 77.5717],
      [12.979, 77.5741],
      [12.976, 77.5741],
      [12.976, 77.5717],
    ],
  ],
  [
    'Stadium',
    [
      [12.98, 77.5986],
      [12.98, 77.6014],
      [12.9776, 77.6014],
      [12.9776, 77.5986],
    ],
  ],
];

/** Landmarks: [name, centre lat/lon, width, depth, rotation in degrees, tags]. */
const LANDMARKS = [
  ['Vidhana Soudha', [12.9796, 77.5905], 105, 215, 0, { height: '46', building: 'government' }],
  ['Vikasa Soudha', [12.9781, 77.5903], 75, 95, 0, { height: '36', building: 'government' }],
  ['High Court of Karnataka', [12.9781, 77.5928], 42, 190, 0, { 'building:levels': '2' }],
  [
    'KSR Bengaluru City Railway Station',
    [12.9781, 77.5699],
    38,
    260,
    0,
    { 'building:levels': '2', building: 'train_station' },
  ],
  ['Kempegowda Bus Station', [12.9788, 77.5729], 120, 14, 0, { 'building:levels': '2' }],
  ['Kempegowda Metro Station', [12.9756, 77.5731], 34, 20, 0, { 'building:levels': '1' }],
  ['KR Market', [12.9643, 77.5764], 110, 80, 10, { 'building:levels': '2', building: 'retail' }],
  ['Town Hall', [12.9632, 77.5853], 62, 34, 0, { height: '18' }],
  ['Hudson Memorial Church', [12.9673, 77.588], 42, 18, 20, { height: '20', building: 'church' }],
  ['BBMP Head Office', [12.9661, 77.5882], 80, 38, 0, { 'building:levels': '3' }],
  ['State Central Library', [12.9765, 77.5934], 62, 30, 0, { 'building:levels': '2' }],
  ['Government Museum', [12.9741, 77.5961], 60, 30, -35, { 'building:levels': '2' }],
  ['Visvesvaraya Museum', [12.9751, 77.597], 70, 38, -35, { 'building:levels': '4' }],
  ['UB City', [12.9709, 77.5963], 62, 62, 0, { 'building:levels': '20', building: 'commercial' }],
  [
    'Concorde Tower',
    [12.9706, 77.5953],
    40,
    40,
    0,
    { 'building:levels': '16', building: 'commercial' },
  ],
  ['St. Mark’s Cathedral', [12.9758, 77.6002], 46, 20, 0, { height: '18', building: 'cathedral' }],
  [
    'Utility Building',
    [12.9751, 77.6096],
    36,
    36,
    0,
    { 'building:levels': '25', building: 'commercial' },
  ],
  ['Mayo Hall', [12.9736, 77.6103], 40, 24, 30, { 'building:levels': '2' }],
  ['Holy Trinity Church', [12.9725, 77.6196], 50, 22, -15, { height: '22', building: 'church' }],
  [
    'Cauvery Bhavan',
    [12.9733, 77.5833],
    60,
    40,
    -40,
    { 'building:levels': '8', building: 'office' },
  ],
  ['General Post Office', [12.9829, 77.5924], 70, 40, 0, { 'building:levels': '3' }],
  ['Shivajinagar Bus Station', [12.9858, 77.605], 90, 55, 0, { 'building:levels': '2' }],
];

// ------------------------------------------------------------ geometry

const bounds = (() => {
  const a = toLocal([BBOX.north, BBOX.west]);
  const b = toLocal([BBOX.south, BBOX.east]);
  return { minX: a.x, minZ: a.z, maxX: b.x, maxZ: b.z };
})();
const inBounds = (p, margin = 0) =>
  p.x > bounds.minX + margin &&
  p.x < bounds.maxX - margin &&
  p.z > bounds.minZ + margin &&
  p.z < bounds.maxZ - margin;

function inRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x)
      inside = !inside;
  }
  return inside;
}
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.min(
    1,
    Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}
function rectangle(centre, width, depth, degrees) {
  const angle = degrees * DEG;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => {
    const x = (sx * width) / 2;
    const z = (sz * depth) / 2;
    return { x: centre.x + x * cos - z * sin, z: centre.z + x * sin + z * cos };
  });
}

const keepOut = [...AREAS.map(([, ring]) => ring), ...COMPOUNDS.map(([, ring]) => ring)].map(
  (ring) => ring.map(toLocal),
);
const blocked = (p) => keepOut.some((ring) => inRing(p, ring));

/** Every road segment, for clearance checks: { a, b, half }. */
const segments = [];
const CELL = 60;
const segmentGrid = new Map();
function indexSegment(segment) {
  segments.push(segment);
  const { a, b } = segment;
  for (
    let gx = Math.floor((Math.min(a.x, b.x) - 30) / CELL);
    gx <= Math.floor((Math.max(a.x, b.x) + 30) / CELL);
    gx++
  ) {
    for (
      let gz = Math.floor((Math.min(a.z, b.z) - 30) / CELL);
      gz <= Math.floor((Math.max(a.z, b.z) + 30) / CELL);
      gz++
    ) {
      const key = `${gx},${gz}`;
      (segmentGrid.get(key) ?? segmentGrid.set(key, []).get(key)).push(segment);
    }
  }
}
function roadClearance(p) {
  let best = Infinity;
  for (const s of segmentGrid.get(`${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`) ?? []) {
    best = Math.min(best, distanceToSegment(p, s.a, s.b) - s.half);
  }
  return best;
}

// ------------------------------------------------------------ roads

const HALF = { primary: 6, secondary: 5, tertiary: 4, residential: 3, service: 1.8 };
const frontages = []; // { a, b, half, major } segments that get buildings along them

for (const [name, highway, half, points, options] of ROADS) {
  const local = points.map(toLocal);
  addWay(local, { highway, name, ...(half >= 8 && { lanes: '6' }) });
  for (let i = 0; i + 1 < local.length; i++) {
    const segment = { a: local[i], b: local[i + 1], half: Math.max(half, HALF[highway]) };
    indexSegment(segment);
    if (!options?.bare) frontages.push({ ...segment, major: highway !== 'residential' });
  }
}

// The metro viaduct above the MG Road median.
addWay(
  [
    [12.9772, 77.5988],
    [12.9765, 77.5996],
    [12.976, 77.603],
    [12.9756, 77.6068],
    [12.975, 77.611],
    [12.974, 77.615],
    [12.973, 77.619],
    [12.9722, 77.6217],
  ].map(toLocal),
  { railway: 'subway', bridge: 'yes', layer: '1', name: 'Purple Line' },
);

// Side streets: a jittered grid, broken wherever it would cross open space or hug a main road.
function lane(from, to, name) {
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.round(length / 20));
  let run = [];
  const flush = () => {
    if (run.length >= 3) {
      addWay(run, { highway: 'residential', name });
      for (let i = 0; i + 1 < run.length; i++) {
        const segment = { a: run[i], b: run[i + 1], half: HALF.residential };
        pendingLanes.push(segment);
        frontages.push({ ...segment, major: false });
      }
    }
    run = [];
  };
  for (let i = 0; i <= steps; i++) {
    const p = {
      x: from.x + ((to.x - from.x) * i) / steps,
      z: from.z + ((to.z - from.z) * i) / steps,
    };
    const clearance = roadClearance(p);
    // Stop at open space; cross main roads but do not run alongside them.
    if (!inBounds(p, 5) || blocked(p) || (clearance > -2 && clearance < 14)) flush();
    else run.push(p);
  }
  flush();
}
const pendingLanes = [];
let laneNumber = 1;
for (let z = bounds.minZ + 70; z < bounds.maxZ - 40; z += 95 + rng() * 60) {
  const tilt = (rng() - 0.5) * 60;
  for (let x = bounds.minX; x < bounds.maxX; x += 520) {
    if (rng() < 0.18) continue;
    lane(
      { x, z: z + (tilt * (x - bounds.minX)) / 6000 },
      { x: x + 520, z: z + (tilt * (x + 520 - bounds.minX)) / 6000 },
      `${laneNumber}th Cross`,
    );
  }
  laneNumber++;
}
laneNumber = 1;
for (let x = bounds.minX + 70; x < bounds.maxX - 40; x += 105 + rng() * 70) {
  const tilt = (rng() - 0.5) * 50;
  for (let z = bounds.minZ; z < bounds.maxZ; z += 480) {
    if (rng() < 0.18) continue;
    lane(
      { x: x + (tilt * (z - bounds.minZ)) / 3000, z },
      { x: x + (tilt * (z + 480 - bounds.minZ)) / 3000, z: z + 480 },
      `${laneNumber}th Main`,
    );
  }
  laneNumber++;
}
for (const segment of pendingLanes) indexSegment(segment);

// ------------------------------------------------------------ areas and landmarks

for (const [tags, ring] of AREAS) addWay(ring.map(toLocal), tags, true);

// Chinnaswamy Stadium: a pitch ringed by stands.
{
  const centre = toLocal([12.9788, 77.6]);
  const circle = (radius, count, phase = 0) =>
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + phase;
      return { x: centre.x + Math.cos(angle) * radius, z: centre.z + Math.sin(angle) * radius };
    });
  addWay(circle(68, 20), { leisure: 'pitch', sport: 'cricket' }, true);
  const inner = circle(76, 12);
  const outer = circle(104, 12);
  for (let i = 0; i < 12; i++) {
    const j = (i + 1) % 12;
    const shrink = (p, q) => ({ x: p.x + (q.x - p.x) * 0.06, z: p.z + (q.z - p.z) * 0.06 });
    addWay(
      [
        shrink(inner[i], inner[j]),
        shrink(inner[j], inner[i]),
        shrink(outer[j], outer[i]),
        shrink(outer[i], outer[j]),
      ],
      {
        building: 'stadium',
        height: '24',
        ...(i === 0 && { name: 'M. Chinnaswamy Stadium' }),
      },
      true,
    );
  }
}

const placed = []; // { x, z, r } circles standing in for building footprints
const placedGrid = new Map();
function claim(centre, radius) {
  const gx = Math.floor(centre.x / CELL);
  const gz = Math.floor(centre.z / CELL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (const other of placedGrid.get(`${gx + dx},${gz + dz}`) ?? []) {
        if (Math.hypot(other.x - centre.x, other.z - centre.z) < (other.r + radius) * 0.82)
          return false;
      }
    }
  }
  const entry = { ...centre, r: radius };
  placed.push(entry);
  const key = `${gx},${gz}`;
  (placedGrid.get(key) ?? placedGrid.set(key, []).get(key)).push(entry);
  return true;
}

for (const [name, at, width, depth, rotation, tags] of LANDMARKS) {
  const centre = toLocal(at);
  addWay(rectangle(centre, width, depth, rotation), { building: 'yes', name, ...tags }, true);
  // Reserve the footprint (as a few circles along its long side) so nothing is generated on top.
  const long = Math.max(width, depth);
  const short = Math.min(width, depth);
  const along = (depth > width ? rotation + 90 : rotation) * DEG;
  for (
    let offset = -long / 2 + short / 2;
    offset <= long / 2 - short / 2 + 0.01;
    offset += Math.max(8, short * 0.8)
  ) {
    claim(
      { x: centre.x + Math.cos(along) * offset, z: centre.z + Math.sin(along) * offset },
      short * 0.75,
    );
  }
}

// ------------------------------------------------------------ ordinary buildings

let buildings = 0;
for (const { a, b, half, major } of frontages) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 8) continue;
  const ux = (b.x - a.x) / length;
  const uz = (b.z - a.z) / length;
  const degrees = Math.atan2(uz, ux) / DEG;
  for (const side of [1, -1]) {
    let along = 4 + rng() * 6;
    while (along < length - 6) {
      const width = major ? 12 + rng() * 14 : 8 + rng() * 9;
      const depth = major ? 12 + rng() * 10 : 8 + rng() * 7;
      const gap = rng() < 0.12 ? 6 + rng() * 14 : 0.8 + rng() * 1.6;
      const setback = half + (major ? 3.2 : 1.8) + depth / 2;
      const centre = {
        x: a.x + ux * (along + width / 2) - uz * setback * side,
        z: a.z + uz * (along + width / 2) + ux * setback * side,
      };
      along += width + gap;
      if (!inBounds(centre, 12) || blocked(centre)) continue;
      const corners = rectangle(centre, width, depth, degrees);
      if (corners.some((corner) => roadClearance(corner) < 1.2 || blocked(corner))) continue;
      if (!claim(centre, Math.min(width, depth) / 2 + 1)) continue;
      const commercial = major && rng() < 0.75;
      const levels = commercial ? 2 + Math.floor(rng() * rng() * 9) : 1 + Math.floor(rng() * 3.4);
      addWay(
        corners,
        { building: commercial ? 'commercial' : 'residential', 'building:levels': String(levels) },
        true,
      );
      buildings++;
    }
  }
}

// ------------------------------------------------------------ write

rmSync(SKETCH_DIR, { recursive: true, force: true });
mkdirSync(SKETCH_DIR, { recursive: true });
writeFileSync(new URL('tile_sketch.json', SKETCH_DIR), JSON.stringify({ sketch: true, elements }));
console.log(
  `Sketch: ${ROADS.length} main roads, ${pendingLanes.length} lane segments, ${buildings} generated buildings, ${LANDMARKS.length} landmarks.`,
);
