import { DEFAULT_RUNTIME_FEATURES } from "../core/configuration/RuntimeProfile";
import { ClientEnv } from "./ClientEnv";

export type { RuntimeFeatures } from "../core/configuration/RuntimeProfile";

export const FEATURES = Object.freeze(
  typeof window === "undefined"
    ? { ...DEFAULT_RUNTIME_FEATURES }
    : ClientEnv.runtimeFeatures(),
);
