import type { RuntimeFeatures } from "../core/configuration/RuntimeProfile";
import { FEATURES } from "./RuntimeProfile";

export interface OptionalFeatureImporters {
  accounts: () => Promise<unknown>;
  clans: () => Promise<unknown>;
  store: () => Promise<unknown>;
  leaderboards: () => Promise<unknown>;
  profiles: () => Promise<unknown>;
  rewards: () => Promise<unknown>;
  ranked: () => Promise<unknown>;
  externalPlatforms: () => Promise<unknown>;
  externalPlatformAccounts: () => Promise<unknown>;
}

const importers: OptionalFeatureImporters = {
  accounts: () =>
    Promise.all([
      import("./AccountModal"),
      import("./TokenLoginModal"),
      import("./GoogleAdElement"),
      import("./components/MarketingConsentToast"),
    ]),
  clans: () => import("./ClanModal"),
  store: () => import("./Store"),
  leaderboards: () => import("./LeaderboardModal"),
  profiles: () => import("./PlayerProfileModal"),
  rewards: () => import("./RewardsModal"),
  ranked: () =>
    Promise.all([import("./Matchmaking"), import("./components/RankedModal")]),
  externalPlatforms: () =>
    Promise.all([
      import("./CrazyGamesSDK").then(({ loadCrazyGamesSDK }) =>
        loadCrazyGamesSDK(),
      ),
      import("./SteamSDK").then(({ loadSteamSDK }) => loadSteamSDK()),
      import("./SteamLinkSignpost"),
    ]),
  externalPlatformAccounts: () => import("./CrazyGamesAccountButton"),
};

export async function loadOptionalFeatures(
  features: Readonly<RuntimeFeatures> = FEATURES,
  featureImporters: OptionalFeatureImporters = importers,
): Promise<void> {
  const imports: Array<Promise<unknown>> = [];
  if (features.accounts) imports.push(featureImporters.accounts());
  if (features.clans) imports.push(featureImporters.clans());
  if (features.store) imports.push(featureImporters.store());
  if (features.leaderboards) imports.push(featureImporters.leaderboards());
  if (features.profiles) imports.push(featureImporters.profiles());
  if (features.rewards) imports.push(featureImporters.rewards());
  if (features.ranked) imports.push(featureImporters.ranked());
  if (features.externalPlatforms) {
    imports.push(featureImporters.externalPlatforms());
    if (features.accounts) {
      imports.push(featureImporters.externalPlatformAccounts());
    }
  }
  await Promise.all(imports);
}
