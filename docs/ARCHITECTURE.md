# Architecture

```
apps/game         Vite + React Three Fiber game client
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
