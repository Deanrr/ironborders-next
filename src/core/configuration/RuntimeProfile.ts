export const RUNTIME_FEATURE_NAMES = [
  "accounts",
  "clans",
  "store",
  "subscriptions",
  "rewards",
  "ranked",
  "telemetry",
  "externalPlatforms",
  "leaderboards",
  "profiles",
] as const;

export type RuntimeFeatureName = (typeof RUNTIME_FEATURE_NAMES)[number];
export type RuntimeFeatures = Record<RuntimeFeatureName, boolean>;

export const DEFAULT_RUNTIME_FEATURES: Readonly<RuntimeFeatures> =
  Object.freeze({
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
  });

export const ALL_RUNTIME_FEATURES: Readonly<RuntimeFeatures> = Object.freeze(
  Object.fromEntries(
    RUNTIME_FEATURE_NAMES.map((name) => [name, true]),
  ) as RuntimeFeatures,
);

const FEATURE_DEPENDENCIES: Readonly<
  Partial<Record<RuntimeFeatureName, readonly RuntimeFeatureName[]>>
> = {
  subscriptions: ["accounts", "store"],
  rewards: ["accounts"],
  clans: ["accounts"],
  ranked: ["accounts"],
  profiles: ["accounts"],
};

const FEATURE_ENV_NAMES: Readonly<Record<RuntimeFeatureName, string>> = {
  accounts: "FEATURE_ACCOUNTS",
  clans: "FEATURE_CLANS",
  store: "FEATURE_STORE",
  subscriptions: "FEATURE_SUBSCRIPTIONS",
  rewards: "FEATURE_REWARDS",
  ranked: "FEATURE_RANKED",
  telemetry: "FEATURE_TELEMETRY",
  externalPlatforms: "FEATURE_EXTERNAL_PLATFORMS",
  leaderboards: "FEATURE_LEADERBOARDS",
  profiles: "FEATURE_PROFILES",
};

export function parseRuntimeFeatures(input: unknown): RuntimeFeatures {
  if (input === undefined) {
    return { ...DEFAULT_RUNTIME_FEATURES };
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Invalid runtime feature profile: expected an object");
  }

  const values = input as Record<string, unknown>;
  const knownNames = new Set<string>(RUNTIME_FEATURE_NAMES);
  const unknownNames = Object.keys(values).filter(
    (name) => !knownNames.has(name),
  );
  if (unknownNames.length > 0) {
    throw new Error(
      `Invalid runtime feature profile: unknown feature ${unknownNames.join(", ")}`,
    );
  }

  const features = { ...DEFAULT_RUNTIME_FEATURES };
  for (const name of RUNTIME_FEATURE_NAMES) {
    const value = values[name];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      throw new Error(
        `Invalid runtime feature profile: ${name} must be a boolean`,
      );
    }
    features[name] = value;
  }
  validateRuntimeFeatureDependencies(features);
  return features;
}

export function parseRuntimeFeaturesFromEnv(
  env: Record<string, string | undefined>,
): RuntimeFeatures {
  const knownEnvNames = new Set(Object.values(FEATURE_ENV_NAMES));
  const unknownNames = Object.keys(env).filter(
    (name) => name.startsWith("FEATURE_") && !knownEnvNames.has(name),
  );
  if (unknownNames.length > 0) {
    throw new Error(
      `Invalid runtime feature profile: unknown feature ${unknownNames.join(", ")}`,
    );
  }

  const values: Partial<RuntimeFeatures> = {};
  for (const name of RUNTIME_FEATURE_NAMES) {
    const envName = FEATURE_ENV_NAMES[name];
    const value = env[envName];
    if (value === undefined || value === "") {
      values[name] = false;
      continue;
    }
    if (value !== "true" && value !== "false") {
      throw new Error(
        `Invalid runtime feature profile: ${envName} must be "true" or "false"`,
      );
    }
    values[name] = value === "true";
  }
  return parseRuntimeFeatures(values);
}

export function validateRuntimeFeatureDependencies(
  features: RuntimeFeatures,
): void {
  for (const [feature, dependencies] of Object.entries(
    FEATURE_DEPENDENCIES,
  ) as Array<[RuntimeFeatureName, readonly RuntimeFeatureName[]]>) {
    if (
      features[feature] &&
      dependencies.some((dependency) => !features[dependency])
    ) {
      throw new Error(
        `Invalid runtime feature profile: ${feature} requires ${dependencies.join(" + ")}`,
      );
    }
  }
}
