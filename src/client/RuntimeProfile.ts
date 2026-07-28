export interface RuntimeFeatures {
  accounts: boolean;
  clans: boolean;
  store: boolean;
  subscriptions: boolean;
  rewards: boolean;
  ranked: boolean;
  telemetry: boolean;
  externalPlatforms: boolean;
  leaderboards: boolean;
  profiles: boolean;
}

const initialProfile: RuntimeFeatures = {
  accounts: false,
  clans: false,
  store: false,
  subscriptions: false,
  rewards: false,
  ranked: false,
  telemetry: false,
  externalPlatforms: false,
  leaderboards: false,
  profiles: false,
};

export const FEATURES: Readonly<RuntimeFeatures> = Object.freeze({
  ...initialProfile,
  ...(window.BOOTSTRAP_CONFIG?.features ?? {}),
});
