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

## Production integrations

OpenFront-specific advertising, analytics, and CrazyGames browser scripts are
disabled by default. The legacy integration markup remains gated for upstream
comparison and runs only when
`ENABLE_LEGACY_OPENFRONT_INTEGRATIONS=true` is explicitly configured.
Reusable Cloudflare Turnstile bot protection remains enabled; localhost uses
Cloudflare's published test site key.

OpenTelemetry, private match telemetry, CDN delivery, and deployment helpers
remain available as reusable infrastructure, but are inactive when their
environment variables are unset. Do not point an Iron Borders deployment at
OpenFront-operated services.

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
