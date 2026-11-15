# Contributing

## Setup

```sh
corepack enable
pnpm install
pnpm dev        # game at http://localhost:5173
pnpm dev:site   # landing site
```

## Before you push

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
pnpm build && pnpm e2e
```

CI runs the same commands. The first `pnpm e2e` needs
`pnpm --filter @blr/game exec playwright install chromium`.

## Rules

- TypeScript strict; no `any`, no lint warnings.
- Game logic goes in `packages/engine` with tests. Content goes in `packages/content`.
- No allocations in per-frame code. Reuse scratch objects.
- Everything is original. Do not copy code, art, text, names or layouts from
  other games. Brands are parodies; no real logos.
- Record every third-party asset and its licence in `CREDITS.md` in the same PR.
- The codename `gta-bengaluru` never appears in player-facing text.
- Small commits with clear messages; one milestone slice per pull request.
