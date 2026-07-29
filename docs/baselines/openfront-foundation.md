# OpenFront foundation baseline

Recorded on 2026-07-28 before Iron Borders combat divergence.

## Foundation

- Foundation commit: `5d3901f31` (`Fix CDN bootstrap template`)
- Upstream baseline: `3e1de8f7a`
- Runtime: Windows, Node.js `v22.14.0`

## Verification

| Check | Result |
| --- | --- |
| `npm test` | Pass: 212 client/core files (2,360 tests) and 30 server files (288 tests) |
| `npm run build-prod` | Pass: TypeScript and Vite production build |
| Runtime profile tests | Pass in `iron-borders-default` and `all-features` modes (6 tests each) |
| Default-profile smoke | Pass: homepage initialized, solo reached starting-location selection, and private lobby `aApBLWfd` was created and joined |
| Disabled-service smoke | Pass: no account/auth/port 8787 browser console activity; `#modal=account` was stripped without opening a modal; optional-loader tests invoked no disabled importers |
| `npm run test:matchmaking` | Blocked: the retained harness imports Playwright, which is not installed in this repository |

The production build emitted account, clan, store, leaderboard, profile,
rewards, ranked/matchmaking, advertising, CrazyGames, and Steam implementations
as separate lazy chunks. They are not initialized by the default-off loader.

## Deterministic simulation

Command: `npm run perf:game`

- Map: World
- Bots: 400
- Nations: map default
- Seed: `perf-default`
- Game ticks: 1,800 (2,102 including spawn)
- Final state hash: `29522092182969730` at tick 2,100
- Simulation time: 8,112 ms over 8,142 ms wall time
- Throughput: 221 ticks/second
- Tick time: mean 4.51 ms, p50 4.01 ms, p95 8.09 ms, p99 18.7 ms
- Peak heap: 83 MB
- Ticks over the 100 ms budget: 0

## Performance harness status

`npm run perf` reached the structure lookup and MIRV benchmarks, but the MIRV
setup flooded `cannot build MIRV` before the aggregate runner exited while
starting `DiffPlayerUpdatePerf`.

- Structure lookup: 151 ops/second for the current O(1) implementation
- MIRV sparse territory: 315,292 ops/second
- MIRV dense territory: 302,994 ops/second
- MIRV giant world (350 targets): 300,640 ops/second

The individual client tools are not currently usable as baseline sources:

- `perf:client` fails because its view shim lacks `updateSmallPlayerGlow`.
- `perf:client-tick` and `perf:client-mem` fail on Windows while spawning
  `npx vite` (`spawn npx ENOENT`).

The full-game simulation metrics above are the retained timing and memory
baseline until those client harnesses are repaired.

## Manual smoke

- Solo: opened the default solo setup, verified no disabled-account
  achievements sign-in affordance, started the game, and reached “Choose a
  starting location.”
- Multiplayer: created private World lobby `aApBLWfd` and joined it through the
  separate Join Lobby flow, reaching “Lobby joined! Waiting for host to start.”
