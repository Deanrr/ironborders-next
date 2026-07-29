import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_RUNTIME_FEATURES } from "../../src/core/configuration/RuntimeProfile";
import { fetchCustomTribes } from "../../src/server/CustomTribes";
import { ServerEnv } from "../../src/server/ServerEnv";

describe("fetchCustomTribes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("does not contact the account API when accounts are disabled", async () => {
    vi.spyOn(ServerEnv, "runtimeFeatures").mockReturnValue({
      ...DEFAULT_RUNTIME_FEATURES,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(fetchCustomTribes([])).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
