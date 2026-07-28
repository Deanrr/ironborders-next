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

const disabledProfile: RuntimeFeatures = {
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

const testProfile: RuntimeFeatures = {
  accounts: true,
  clans: true,
  store: true,
  subscriptions: true,
  rewards: true,
  ranked: true,
  telemetry: true,
  externalPlatforms: true,
  leaderboards: true,
  profiles: true,
};

const initialProfile: RuntimeFeatures =
  import.meta.env.MODE === "test" ? testProfile : disabledProfile;

export const FEATURES: Readonly<RuntimeFeatures> = Object.freeze({
  ...initialProfile,
  ...(window.BOOTSTRAP_CONFIG?.features ?? {}),
});
