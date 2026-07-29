// Add global mocks or configuration here if needed
import "vitest-canvas-mock";
import {
  ALL_RUNTIME_FEATURES,
  DEFAULT_RUNTIME_FEATURES,
} from "../src/core/configuration/RuntimeProfile";

const features =
  process.env.IRON_BORDERS_TEST_PROFILE === "all-features"
    ? ALL_RUNTIME_FEATURES
    : DEFAULT_RUNTIME_FEATURES;

window.BOOTSTRAP_CONFIG ??= {
  gameEnv: "dev",
  numWorkers: 2,
  turnstileSiteKey: "disabled",
  jwtAudience: "localhost",
  instanceId: "TEST",
  gitCommit: "TEST",
  publicOrigin: "http://localhost:9000",
  gameServerOrigin: "http://localhost:9000",
  accountApiOrigin: "http://localhost:8787",
  features: { ...features },
};
