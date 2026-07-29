import { describe, expect, test, vi } from "vitest";
import {
  loadOptionalFeatures,
  OptionalFeatureImporters,
} from "../../src/client/OptionalFeatures";
import {
  ALL_RUNTIME_FEATURES,
  DEFAULT_RUNTIME_FEATURES,
} from "../../src/core/configuration/RuntimeProfile";

function importerSpies(): OptionalFeatureImporters {
  return {
    accounts: vi.fn(async () => {}),
    clans: vi.fn(async () => {}),
    store: vi.fn(async () => {}),
    leaderboards: vi.fn(async () => {}),
    profiles: vi.fn(async () => {}),
    rewards: vi.fn(async () => {}),
    ranked: vi.fn(async () => {}),
    externalPlatforms: vi.fn(async () => {}),
    externalPlatformAccounts: vi.fn(async () => {}),
  };
}

describe("default runtime profile smoke", () => {
  test("does not initialize inherited product, telemetry, or platform modules", async () => {
    const spies = importerSpies();
    await loadOptionalFeatures(DEFAULT_RUNTIME_FEATURES, spies);
    expect(
      Object.values(spies).every((spy) => !vi.mocked(spy).mock.calls.length),
    ).toBe(true);
    expect(DEFAULT_RUNTIME_FEATURES.telemetry).toBe(false);
  });

  test("retains bounded all-features compatibility loading", async () => {
    const spies = importerSpies();
    await loadOptionalFeatures(ALL_RUNTIME_FEATURES, spies);
    expect(
      Object.values(spies).every(
        (spy) => vi.mocked(spy).mock.calls.length === 1,
      ),
    ).toBe(true);
  });
});
