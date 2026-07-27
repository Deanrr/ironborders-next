# Iron Borders notices

Iron Borders is derived from OpenFrontIO:

- Upstream repository: <https://github.com/openfrontio/OpenFrontIO>
- Upstream baseline commit:
  `3e1de8f7a184193b00c50929bdceb92bcdd9f92e`
- Baseline date: 2026-07-27
- Source license: GNU Affero General Public License v3.0

OpenFrontIO's commit history, contributor attribution, `LICENSE`,
`LICENSE-ASSETS`, `LICENSING.md`, `CREDITS.md`, and asset-specific notices are
retained. The original OpenFront brand files remain in `proprietary` for
license and history continuity, but Iron Borders does not reference them for
its visible identity.

## Iron Borders modifications

### 2026-07-27 — identity and local foundation

- Renamed visible application, document, manifest, and English UI branding to
  Iron Borders.
- Added original temporary Iron Borders SVG wordmark, shield, favicon, and
  restrained background placeholders under `resources/images`.
- Replaced visible navigation, splash/loading, footer, metadata, favicon, and
  primary palette references without changing gameplay logic.
- Replaced OpenFront community and service links in the product footer with
  Iron Borders source, upstream attribution, and AGPL license links.
- Removed the package shortcuts that connected local development directly to
  OpenFront staging and production APIs.
- Gated legacy OpenFront advertising, analytics, CrazyGames, Cloudflare
  Insights, and Playwire/Intergient browser scripts behind the
  disabled-by-default
  `ENABLE_LEGACY_OPENFRONT_INTEGRATIONS` setting.
- Retained reusable Cloudflare Turnstile bot protection with its published
  localhost test key so local joins preserve upstream behavior.
- Reworked `example.env` around localhost-safe defaults; reusable CDN,
  OpenTelemetry, and private match telemetry remain opt-in.
- Blocked stale `openfront.io` and `openfront.dev` browser API-host overrides
  while preserving local and self-hosted development overrides.
- Added Windows PowerShell setup, verification commands, upstream
  synchronization guidance, and AGPL source-availability guidance to the
  README.

## Files changed in this baseline

- `package.json`
- `package-lock.json`
- `index.html`
- `vite.config.ts`
- `example.env`
- `README.md`
- `IRON_BORDERS_NOTICES.md`
- `resources/manifest.json`
- `resources/lang/en.json`
- `resources/images/IronBordersBackground.svg`
- `resources/images/IronBordersFavicon.svg`
- `resources/images/IronBordersLogo.svg`
- `resources/images/IronBordersMark.svg`
- `src/client/ClientEnv.ts`
- `src/client/Api.ts`
- `src/client/GameStartingModal.ts`
- `src/client/Main.ts`
- `src/client/components/DesktopNavBar.ts`
- `src/client/components/Footer.ts`
- `src/client/components/MobileNavBar.ts`
- `src/client/components/PlayPage.ts`
- `src/client/styles.css`
- `src/core/configuration/Config.ts`
- `src/server/RenderHtml.ts`

No combat, economy, AI, map ownership, diplomacy, multiplayer protocol,
deterministic simulation, or persistence behavior was intentionally changed.

### 2026-07-27 — self-owned service boundary

- Removed public links to third-party community, store, source-hosting, video,
  streaming, advertising, analytics, and bot-challenge services.
- Added same-origin notices, source, tutorial, privacy, and terms pages.
- Kept multiplayer lobby discovery, game creation, and WebSockets on
  owner-operated same-origin routes.
- Disabled remote join verification by default while preserving the local name
  censor and owner-configurable verification boundary.
- Retained API, account, clan, store, CDN, OpenTelemetry, and match telemetry
  modules for use only with operator-controlled services.
- Removed third-party OAuth choices from the default account UI while retaining
  the owner-operated email magic-link path.
- Disabled Discord invite resolution, external clan destinations, remote
  avatars, and third-party checkout navigation; clan and store modules continue
  to use the operator API and same-origin destinations.
- Rejected OpenFront API and desktop game-server audiences and removed
  browser-stored API host overrides.
- Converted upstream changelog references and contributor mentions to plain
  text so the product UI does not create external source-hosting links.
- Replaced the inherited remote news and promotional content with local Iron
  Borders information.
