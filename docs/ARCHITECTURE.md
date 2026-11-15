# Architecture

```
apps/game         Vite + React + three.js game client
apps/site         Astro landing page
packages/engine   Framework-free game logic (no React, no three.js imports required)
packages/content  Data: branding, tips, and later missions, dialogue, vehicle specs
tools/osm         Offline OSM extraction and chunk baking
tools/assets      glTF compression pipeline
tools/blender     Optional Blender scripts
docs              This folder
```

## Principles

- **Logic lives in `packages/engine`**, is pure TypeScript and is unit-tested
  with Vitest. The game app is a thin rendering and input layer over it.
- **Content is data.** Names, credits, tips and (from M4) missions live in
  `packages/content`, so new content needs no engine changes. The public title
  is set in one place: `packages/content/src/branding.ts`.
- **Fixed-timestep simulation.** `FixedStepLoop` advances the simulation at
  60 Hz independent of render rate and returns an interpolation alpha.
- **No allocations in hot loops.** Per-frame code reuses scratch objects;
  repeated geometry is drawn with `InstancedMesh`.
- **Deterministic generation.** Procedural content uses the seeded `createRng`,
  so the same seed always builds the same world (needed for replays in M6/M7).
- **The 3D scene is a lazy chunk.** The HTML boot shell paints immediately,
  then the title UI, then three.js and the scene.

## World streaming

1. **Bake (offline).** `tools/osm` converts OpenStreetMap into compact chunk
   files: integer decimetre coordinates, one JSON file per 250 m tile.
2. **Mesh (worker).** `chunk.worker.ts` fetches a chunk and calls
   `buildChunkMeshes` from `packages/engine`, which returns typed arrays for
   walls, solid shadow casters, flat ground, trees and tanks. Buffers are
   transferred, not copied.
3. **Stream (main thread).** `ChunkStreamer` keeps chunks within 1 km of the
   camera's focus point loaded, nearest first, at most four requests in
   flight, and unloads beyond 1.3 km. Shadows, tanks and trees switch off with
   distance. All chunks share six materials, so a chunk costs about six draw
   calls.

The geometry code is pure TypeScript with no three.js dependency, so it is
unit-tested directly and can be reused by other tools.

## Renderer

WebGL2 via three.js `WebGLRenderer`. The original plan called for WebGPU with
a WebGL2 fallback; that is deferred because the `postprocessing` library only
supports the WebGL renderer and drei's WebGPU coverage is partial. It will be
re-evaluated in M5 when the final look is built.

## Deployment

Vercel builds every branch from `apps/site/vercel.json`: it builds the whole
workspace and copies the game into the site output, so the landing page is at
`/` and the game at `/play/`.

`deploy-preview.yml` publishes the site at `/` and the game at `/play/` on
GitHub Pages. Base paths come from `SITE_BASE` and `GAME_BASE`, so moving to
Vercel or Cloudflare Pages needs no code changes.

## The living city

Characters, missions and the guide are data in `packages/content/src/city/`,
run by pure functions in `packages/engine/src/city/`:

- `dialogue.ts` walks a character's conversation graph. Conditions read the
  city's memory (facts, meetings, coins, items), the clock, the weather and
  mission state; effects write back. That is all "remembering" is.
- `bargain.ts` is the auto-fare haggle; `transit.ts` the metro and bus
  timetable; `world.ts` the clock, rain and traffic; `missions.ts` the step
  machine; `guide.ts` the "Ask the city" matcher.
- `anchors.ts` names real places by latitude and longitude. The map bake snaps
  each one to open ground or road and stores it in the world index, so
  characters never stand inside a wall.

In the app, `state/city.ts` is the one store that ties these together and
saves to `localStorage`. `game/GameView.ts` is plain three.js: it owns the
renderer, the player (on foot, in an auto, or the drone camera), collision
against building walls, and the figures in the world. It reports the player's
position to the store a few times a second and never decides game rules.

To add a character: add an entry to `npcs.ts`, place it at an anchor, and run
`pnpm test`; the content tests check every graph for dead ends and every
mission event for someone who can raise it.
