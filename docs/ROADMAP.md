# Roadmap

The project brief was replaced on 2026-11-13 by **Rowdy Journey** (v2): a story-driven
game about a newcomer robbed by his first friend in the city, Auto Anna Kiran.
The first-plan M0 and M1 further down are the foundation it builds on.

| #   | Milestone (v2)                                                           | Done when                      | Status        |
| --- | ------------------------------------------------------------------------ | ------------------------------ | ------------- |
| M0  | Audit, critique, 3D tiles vs OSM vs 2.5D comparison                      | Direction chosen               | **In review** |
| M1  | Real-Bengaluru Koramangala slice: street clutter, signage, ambient audio | Passes the blind test          | Next          |
| M2  | Auto driving, Auto Anna Kiran, character intro system                    | Fun to drive; intro card plays |               |
| M3  | Act 1 tutorial (airport to PG)                                           | Fully playable                 |               |
| M4  | Landing page and hero video v1                                           | Coffee, bus, Kiran             |               |
| M5  | Act 2 betrayal, Act 3 detective missions                                 | Playable                       |               |
| M6  | Acts 4 and 5, gang bosses, final chase at Silk Board                     | Playable                       |               |
| M7  | Polish, performance, mobile, final trailer, launch                       | Public launch                  |               |

## v2 M0 — direction

Decision: stay in 3D on our own OpenStreetMap geometry and dress it heavily at
street level; use Google Photorealistic 3D Tiles live for aerial hero views only;
keep the top-down view as the full-screen map. Reasons and the full M1/M2 plan
are in the M0 document linked from the pull request.

Prototypes in the build:

- `?view=top` — top-down drive with a placeholder auto (no collision).
- `?view=tiles` — Google 3D Tiles viewer; needs `VITE_GOOGLE_MAPS_API_KEY`.
  **Untested**: no key was available when it was written.

## Open decisions

- **Public title.** `gta-bengaluru` is a codename only and never appears in
  player-facing text. Working title is _Rowdy Journey_; candidates: _Rowdy
  Journey: Bengaluru_, _Namma Rowdy_, _Auto Anna_, _Rowdy Ooru_, _Meter Haaki_.
- **Kiran concept** (A, B or C in the M0 document).
- **Google Maps Platform key** for the 3D Tiles hero views.

# First plan (foundation, complete)

## M0 — delivered

- pnpm monorepo, strict TypeScript, ESLint, Prettier, Vitest, Playwright smoke test, CI.
- Game shell: instant boot screen, title screen, pause menu, About dialog, credits.
- Test street: procedurally generated lane with instanced buildings, trees and
  rooftop tanks, real-time sun shadows and a time-of-day slider.
- Engine utilities with tests: fixed-timestep loop, seeded RNG, sun model.
- Landing site stub and GitHub Pages deploy workflow.

## M1 — delivered

- `tools/osm/fetch.mjs` downloads the Koramangala, Silk Board and HSR-fringe extract
  (3.8 km x 3.3 km) from the OpenStreetMap API into a git-ignored cache.
- `tools/osm/bake.ts` turns it into 224 chunks of 250 m: 23,457 real building
  footprints, 4,796 road runs, 216 parks, pitches and lakes, 12,177 trees.
  The whole world is 1.7 MB of JSON (about 0.7 MB compressed).
- Roads are drawn at their real alignment with widths by class, footpaths and
  lane markings. Long bridges become flyovers with ramps, decks, parapets and
  pillars (Silk Board included); the metro viaduct is elevated.
- Buildings are extruded with tiled window facades, shopfronts with signboard
  bands and awnings, and rooftop water tanks; windows light up at night.
- Chunks are fetched and meshed in a Web Worker and streamed within 1 km of
  the camera, with two detail levels and unloading behind you.
- Fly camera (WASD, drag to look, Q/E, Shift), drone orbit on the title
  screen, nearest-landmark label, FPS / draw-call / triangle readout, and
  visible OpenStreetMap attribution.

### M1 gaps, carried forward

- **Frame rate is not verified on real hardware.** The build environment only
  has software rendering. A typical view is about 160 draw calls and 200k
  triangles, which should be comfortable, but it needs a real-GPU check.
- **Two detail levels, not three, and no impostors.** Fog hides the load edge
  at 1 km. A third level will be added if profiling shows it is needed.
- **Hero landmarks are not hand-modelled yet** (mall, Sony World signal, water
  tank, cricket ground). They currently appear as generic extrusions.
- **Props still missing:** street lamps, bus stops, signals, stalls, hoardings,
  cables, potholes and speed breakers. Roads are unlit at night.
- **Navigation graph export** moved to M3, where traffic first needs it.
- **Building heights are mostly estimated**: only about 2% of footprints carry
  a height or level count in OpenStreetMap.
- Touch controls for the fly camera are look-only; movement needs a keyboard.
