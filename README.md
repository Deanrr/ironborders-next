# Iron Borders

Iron Borders is an open-source territorial strategy game derived from
[OpenFrontIO](https://github.com/openfrontio/OpenFrontIO). This foundation
slice changes product identity and local-development defaults while preserving
the upstream gameplay simulation, networking boundaries, maps, and game rules.

The exact upstream baseline and the current modification summary are recorded
in [IRON_BORDERS_NOTICES.md](IRON_BORDERS_NOTICES.md).

## Windows PowerShell setup

Prerequisites:

- Git for Windows
- Node.js with npm 10.9.2 or newer
- A modern Chromium-based browser

```powershell
git clone https://github.com/Deanrr/ironborders-next.git
cd ironborders-next
git remote add upstream https://github.com/openfrontio/OpenFrontIO.git
git remote -v
npm run inst
npm run dev
```

The development command starts the Vite client on `http://localhost:9000` and
the local game services on ports `3000` through `3002`. Set
`SKIP_BROWSER_OPEN=true` before running the command if the browser should not
open automatically.

Use `npm run inst`, not `npm install`: it runs `npm ci --ignore-scripts` and
installs the exact dependency versions in `package-lock.json` without package
lifecycle scripts.

## Development commands

| Command                    | Purpose                                               |
| -------------------------- | ----------------------------------------------------- |
| `npm run inst`             | Install locked dependencies without lifecycle scripts |
| `npm run dev`              | Run the client and local game services                |
| `npm run start:client`     | Run only the Vite client                              |
| `npm run start:server-dev` | Run only the local game services                      |
| `npm test`                 | Run the Vitest client/core and server suites          |
| `npm run lint`             | Run ESLint                                            |
| `npm run typecheck`        | Run TypeScript without emitting files                 |
| `npm run build-dev`        | Typecheck and create a development build              |
| `npm run build-prod`       | Typecheck and create an optimized production build    |
| `npm run format`           | Format supported repository files                     |

Local development is same-origin and localhost-only by default. The repository
does not provide shortcuts to OpenFront production or staging APIs.
`example.env` documents the safe defaults and opt-in self-hosting settings.

## Repository structure

- `src/client` — Lit browser client, HUD, menus, rendering, and sound
- `src/core` — deterministic simulation, configuration, and shared schemas
- `src/server` — Express and WebSocket game services
- `resources` — public assets, maps, localization, and content
- `proprietary` — separately licensed upstream assets retained for history
- `tests` — Vitest, matchmaking, performance, and pathfinding checks
- `map-generator` — Go-based map generation tooling

## Origin and upstream workflow

The intended remotes are:

- `origin` — `https://github.com/Deanrr/ironborders-next.git`
- `upstream` — `https://github.com/openfrontio/OpenFrontIO.git`

Verify them before synchronizing:

```powershell
git remote -v
git fetch origin
git fetch upstream
```

Safely fast-forward the fork's `main` branch to an unchanged upstream `main`:

```powershell
git switch main
git status --short
git merge --ff-only upstream/main
git push origin main
```

Then bring the updated baseline into an Iron Borders feature branch without
rewriting a published branch:

```powershell
git switch feature/iron-borders-foundation
git merge main
npm run typecheck
npm test
npm run lint
npm run build-prod
```

If `git merge --ff-only upstream/main` fails, stop and inspect the divergence.
Do not force-push or discard local commits to make synchronization succeed.

## Self-owned service boundary

The browser loads no third-party advertising, analytics, platform SDK,
streaming, social promotion, tutorial, or challenge scripts. Public notices,
source information, legal placeholders, and the tutorial are served from the
same Iron Borders origin.

Multiplayer remains enabled through the owner-operated game server. Lobby
discovery, game creation, and WebSockets use same-origin routes. In a hosted
deployment, `DOMAIN` and the API service at `api.<DOMAIN>` must both be under
the operator's control.

Join verification is disabled by default with
`JOIN_VERIFICATION_ENABLED=false` and `TURNSTILE_SITE_KEY=disabled`. The game
server still applies its local username and clan-tag censor, but an operator
must add an owner-controlled abuse-prevention service before enabling
verification in production.

OpenTelemetry, private match telemetry, CDN delivery, account, clan, store, and
deployment modules remain available as optional infrastructure. Configure them
only with endpoints, credentials, storage, and policies controlled by the Iron
Borders operator. The default account UI uses the operator API's email magic
link flow; third-party OAuth buttons are not exposed. Clan gameplay remains
available without resolving or linking to Discord. Store checkout and
subscription navigation are accepted only when the operator API returns a URL
on the current Iron Borders origin, so an owner-controlled reverse proxy is
required for hosted payment flows.

The client rejects `openfront.io` and `openfront.dev` as configured API or
desktop game-server audiences. Local API host overrides are not read from
browser storage. Production `DOMAIN`, optional `API_DOMAIN`, `CDN_ORIGIN`,
OpenTelemetry, and telemetry endpoints must be reviewed as part of deployment;
the application cannot prove domain ownership on the operator's behalf.

Before public hosting, replace the local privacy and terms placeholders and
make the exact Corresponding Source archive for the deployed commit available
from the local source page.

## Runtime profile

Iron Borders defaults to solo play, public/private multiplayer, settings, help,
and local cosmetic selection. Accounts, clans, store, subscriptions, rewards,
ranked play, telemetry, external platforms, leaderboards, and profiles are
disabled by default through the `FEATURE_*` environment flags in
[`example.env`](example.env). Do not enable a service until its server, policy,
and operations are controlled by the Iron Borders operator.

Deployment origins are explicit: `PUBLIC_ORIGIN`, `GAME_SERVER_ORIGIN`,
`ACCOUNT_API_ORIGIN`, and `CDN_ORIGIN`. They must be absolute HTTP(S)
origins; the inherited OpenFront domains are rejected.

## Licensing and source availability

The inherited source is licensed under the
[GNU Affero General Public License v3.0](LICENSE). Asset terms and license
history are documented in [LICENSE-ASSETS](LICENSE-ASSETS),
[LICENSING.md](LICENSING.md), and the asset-specific license files.

If a modified version is hosted for users over a network, AGPL-3.0 section 13
requires the operator to offer those users the Corresponding Source for the
running modified version, at no charge, through the same network interaction.
Keep copyright, attribution, license notices, and modification history intact.

## Credits

Iron Borders preserves OpenFrontIO's authorship and license history. See
[CREDITS.md](CREDITS.md) for upstream contributor credits and
[IRON_BORDERS_NOTICES.md](IRON_BORDERS_NOTICES.md) for fork-specific changes.
