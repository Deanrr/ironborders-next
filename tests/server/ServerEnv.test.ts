import { afterEach, describe, expect, test, vi } from "vitest";
import { ServerEnv } from "../../src/server/ServerEnv";

const initialPublicOrigin = process.env.PUBLIC_ORIGIN;
const initialGameServerOrigin = process.env.GAME_SERVER_ORIGIN;

describe("ServerEnv.numWorkers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns parsed value when valid", () => {
    vi.stubEnv("NUM_WORKERS", "4");
    expect(ServerEnv.numWorkers()).toBe(4);
  });

  test("throws when unset", () => {
    vi.stubEnv("NUM_WORKERS", "");
    expect(() => ServerEnv.numWorkers()).toThrow(/NUM_WORKERS not set/);
  });

  test("throws on non-numeric", () => {
    vi.stubEnv("NUM_WORKERS", "abc");
    expect(() => ServerEnv.numWorkers()).toThrow(/Invalid NUM_WORKERS/);
  });

  test("throws on zero", () => {
    vi.stubEnv("NUM_WORKERS", "0");
    expect(() => ServerEnv.numWorkers()).toThrow(/Invalid NUM_WORKERS/);
  });

  test("throws on negative", () => {
    vi.stubEnv("NUM_WORKERS", "-2");
    expect(() => ServerEnv.numWorkers()).toThrow(/Invalid NUM_WORKERS/);
  });
});

describe("ServerEnv.turnstileSiteKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns value when set", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "site-key");
    expect(ServerEnv.turnstileSiteKey()).toBe("site-key");
  });

  test("throws when unset", () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    expect(() => ServerEnv.turnstileSiteKey()).toThrow(
      /TURNSTILE_SITE_KEY not set/,
    );
  });
});

describe("ServerEnv.jwtAudience", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns DOMAIN when set", () => {
    vi.stubEnv("DOMAIN", "ironborders.example");
    expect(ServerEnv.jwtAudience()).toBe("ironborders.example");
  });

  test("throws when DOMAIN unset", () => {
    vi.stubEnv("DOMAIN", "");
    expect(() => ServerEnv.jwtAudience()).toThrow(/DOMAIN not set/);
  });
});

describe("ServerEnv.jwtIssuer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("maps 'localhost' to http://localhost:8787", () => {
    vi.stubEnv("DOMAIN", "localhost");
    expect(ServerEnv.jwtIssuer()).toBe("http://localhost:8787");
  });

  test("derives api.<audience> for non-localhost", () => {
    vi.stubEnv("DOMAIN", "ironborders.example");
    expect(ServerEnv.jwtIssuer()).toBe("https://api.ironborders.example");
  });

  test("rejects an upstream audience", () => {
    vi.stubEnv("DOMAIN", "openfront.io");
    expect(() => ServerEnv.jwtIssuer()).toThrow(
      "Refusing to connect to an OpenFront production audience",
    );
  });
});

describe("ServerEnv public game origins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    if (initialPublicOrigin === undefined) {
      delete process.env.PUBLIC_ORIGIN;
    } else {
      process.env.PUBLIC_ORIGIN = initialPublicOrigin;
    }
    if (initialGameServerOrigin === undefined) {
      delete process.env.GAME_SERVER_ORIGIN;
    } else {
      process.env.GAME_SERVER_ORIGIN = initialGameServerOrigin;
    }
  });

  test("defaults the standalone server and its game sockets to port 3000", () => {
    delete process.env.PUBLIC_ORIGIN;
    delete process.env.GAME_SERVER_ORIGIN;

    expect(ServerEnv.publicOrigin()).toBe("http://localhost:3000");
    expect(ServerEnv.gameServerOrigin()).toBe("http://localhost:3000");
  });

  test("allows the Vite development client to provide its own origin", () => {
    vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:9000");
    vi.stubEnv("GAME_SERVER_ORIGIN", "http://localhost:9000");

    expect(ServerEnv.publicOrigin()).toBe("http://localhost:9000");
    expect(ServerEnv.gameServerOrigin()).toBe("http://localhost:9000");
  });
});

describe("ServerEnv.allowedFlares", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns undefined when unset", () => {
    vi.stubEnv("ALLOWED_FLARES", "");
    expect(ServerEnv.allowedFlares()).toBeUndefined();
  });

  test("parses a single value", () => {
    vi.stubEnv("ALLOWED_FLARES", "admin");
    expect(ServerEnv.allowedFlares()).toEqual(["admin"]);
  });

  test("parses CSV", () => {
    vi.stubEnv("ALLOWED_FLARES", "admin,beta,internal");
    expect(ServerEnv.allowedFlares()).toEqual(["admin", "beta", "internal"]);
  });

  test("trims whitespace and drops empties", () => {
    vi.stubEnv("ALLOWED_FLARES", " admin , , beta ");
    expect(ServerEnv.allowedFlares()).toEqual(["admin", "beta"]);
  });
});
