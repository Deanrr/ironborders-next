import { describe, expect, test } from "vitest";
import {
  ALL_RUNTIME_FEATURES,
  DEFAULT_RUNTIME_FEATURES,
  parseRuntimeFeatures,
  parseRuntimeFeaturesFromEnv,
} from "../../../src/core/configuration/RuntimeProfile";

describe("runtime profile", () => {
  test("iron-borders-default keeps inherited services off", () => {
    expect(parseRuntimeFeatures(undefined)).toEqual(DEFAULT_RUNTIME_FEATURES);
    expect(
      Object.values(DEFAULT_RUNTIME_FEATURES).every((value) => !value),
    ).toBe(true);
  });

  test("all-features preserves upstream compatibility coverage", () => {
    expect(parseRuntimeFeatures(ALL_RUNTIME_FEATURES)).toEqual(
      ALL_RUNTIME_FEATURES,
    );
  });

  test("rejects unknown feature names", () => {
    expect(() =>
      parseRuntimeFeatures({ ...DEFAULT_RUNTIME_FEATURES, achievements: true }),
    ).toThrow(/unknown feature achievements/);
  });

  test("rejects non-boolean feature values", () => {
    expect(() => parseRuntimeFeatures({ accounts: "true" })).toThrow(
      /accounts must be a boolean/,
    );
  });

  test("validates dependencies in every environment", () => {
    expect(() => parseRuntimeFeatures({ ranked: true })).toThrow(
      /ranked requires accounts/,
    );
    expect(() =>
      parseRuntimeFeaturesFromEnv({
        GAME_ENV: "dev",
        FEATURE_SUBSCRIPTIONS: "true",
        FEATURE_ACCOUNTS: "true",
      }),
    ).toThrow(/subscriptions requires accounts \+ store/);
  });

  test("strictly parses environment feature values", () => {
    expect(() =>
      parseRuntimeFeaturesFromEnv({ FEATURE_ACCOUNTS: "yes" }),
    ).toThrow(/FEATURE_ACCOUNTS must be "true" or "false"/);
    expect(() =>
      parseRuntimeFeaturesFromEnv({ FEATURE_ACHIEVEMENTS: "true" }),
    ).toThrow(/unknown feature FEATURE_ACHIEVEMENTS/);
  });
});
