# tools/osm

Offline map pipeline. Nothing here runs in the browser.

```sh
pnpm world:fetch   # downloads the raw extract into tools/osm/cache/ (git-ignored)
pnpm world:bake    # writes apps/game/public/world/ (committed)
```

- `config.mjs` sets the play area (Koramangala, Silk Board, HSR fringe), the
  origin and the chunk size.
- `fetch.mjs` pulls the area from the OpenStreetMap API in small tiles, with a
  pause between requests. Cached tiles are never re-fetched; delete the cache
  to refresh.
- `bake.ts` projects everything to local metres, classifies roads, raises
  flyovers, estimates building heights, places trees, and writes one compact
  JSON file per 250 m chunk plus `index.json`. It is deterministic.

The chunk format is defined in `packages/engine/src/world/format.ts`, and the
geometry is built at runtime by `buildChunkMeshes` in the same package.

OSM data is © OpenStreetMap contributors (ODbL) and must stay attributed
in-game and in `CREDITS.md`.
