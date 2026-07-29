import { describe, expect, it, vi } from "vitest";
import { Cell, Nation, PlayerInfo, PlayerType } from "../src/core/game/Game";
import type { GameMap } from "../src/core/game/GameMap";
import {
  AuthorityState,
  deriveAuthorityState,
  deriveNationalMilestones,
  deriveOccupationResistance,
  advanceOccupationResistance,
  deriveOverextension,
  deriveGeographicLocations,
  deriveSupply,
  advanceWarExhaustion,
  deriveNationalProductionModifier,
  deriveCapitalThreatened,
  deriveStrategicLocations,
  NationalEventType,
  NationalFramingTracker,
  StrategicLocationType,
  resolveCapitalTile,
} from "../src/core/game/NationalFraming";
import { setup } from "./util/Setup";

function testMap(land: Set<number>): GameMap {
  return {
    width: () => 3,
    height: () => 3,
    ref: (x, y) => y * 3 + x,
    isValidRef: (ref) => ref >= 0 && ref < 9,
    isValidCoord: (x, y) => x >= 0 && x < 3 && y >= 0 && y < 3,
    isLand: (ref) => land.has(ref),
    numLandTiles: () => land.size,
  } as GameMap;
}

describe("deriveAuthorityState", () => {
  it("prioritizes occupation and elimination over threat styling", () => {
    expect(
      deriveAuthorityState({
        isAlive: false,
        territoryFraction: 0,
        capitalOwned: false,
        capitalThreatened: true,
        capitalEncircled: true,
      }),
    ).toBe(AuthorityState.FullyOccupied);
    expect(
      deriveAuthorityState({
        isAlive: true,
        territoryFraction: 0.8,
        capitalOwned: false,
        capitalThreatened: false,
        capitalEncircled: false,
      }),
    ).toBe(AuthorityState.CapitalOccupied);
    expect(
      deriveAuthorityState({
        isAlive: true,
        territoryFraction: 0.2,
        capitalOwned: false,
        capitalThreatened: false,
        capitalEncircled: false,
      }),
    ).toBe(AuthorityState.GovernmentDisplaced);
  });

  it("distinguishes sovereign, partial, threatened, and liberated states", () => {
    const base = {
      isAlive: true,
      territoryFraction: 1,
      capitalOwned: true,
      capitalThreatened: false,
      capitalEncircled: false,
    } as const;
    expect(deriveAuthorityState(base)).toBe(AuthorityState.Sovereign);
    expect(deriveAuthorityState({ ...base, territoryFraction: 0.6 })).toBe(
      AuthorityState.PartiallyOccupied,
    );
    expect(deriveAuthorityState({ ...base, capitalThreatened: true })).toBe(
      AuthorityState.CapitalThreatened,
    );
    expect(deriveAuthorityState({ ...base, contested: true })).toBe(
      AuthorityState.Contested,
    );
    expect(deriveAuthorityState({ ...base, wasLiberated: true })).toBe(
      AuthorityState.Liberated,
    );
  });
});

describe("deriveCapitalThreatened", () => {
  it("treats adjacent hostile territory as a capital threat", () => {
    const player = {
      id: () => "nation",
      incomingAttacks: () => [],
      isFriendly: () => false,
    } as any;
    const enemy = { isPlayer: () => true, id: () => "enemy" } as any;
    const game = {
      neighbors4: (_tile: number, out: number[]) => {
        out[0] = 1;
        return 1;
      },
      owner: () => enemy,
    } as any;

    expect(deriveCapitalThreatened(game, player, 0)).toBe(true);
  });

  it("ignores adjacent allied territory without an active attack", () => {
    const player = {
      id: () => "nation",
      incomingAttacks: () => [],
      isFriendly: () => true,
    } as any;
    const ally = { isPlayer: () => true, id: () => "ally" } as any;
    const game = {
      neighbors4: (_tile: number, out: number[]) => {
        out[0] = 1;
        return 1;
      },
      owner: () => ally,
    } as any;

    expect(deriveCapitalThreatened(game, player, 0)).toBe(false);
  });
});

describe("resolveCapitalTile", () => {
  it("uses manifest coordinates when they identify land", () => {
    const map = testMap(new Set([0, 4, 8]));
    const nation = new Nation(
      new Cell(1, 1),
      new PlayerInfo("Testland", PlayerType.Nation, null, "nation-1"),
    );
    expect(resolveCapitalTile(map, nation)).toBe(4);
  });

  it("uses the spawned tile for generated nations", () => {
    const map = testMap(new Set([0, 8]));
    const nation = new Nation(
      undefined,
      new PlayerInfo("Generated", PlayerType.Nation, null, "nation-2"),
    );
    expect(resolveCapitalTile(map, nation, 8)).toBe(8);
  });

  it("uses a stable first-land fallback when metadata is missing", () => {
    const map = testMap(new Set([2, 7]));
    const nation = new Nation(
      undefined,
      new PlayerInfo("Fallback", PlayerType.Nation, null, "nation-3"),
    );
    expect(resolveCapitalTile(map, nation)).toBe(7);
  });
});

describe("deriveNationalMilestones", () => {
  const summary = (territoryFraction: number, ownerID: string | null) =>
    ({
      nationID: "nation-1",
      displayName: "Testland",
      capital: {
        id: "nation-1:capital",
        type: "capital",
        ownerID,
        tile: 4,
      },
      authorityState: AuthorityState.Sovereign,
      territoryTiles: Math.round(territoryFraction * 100),
      territoryFraction,
      troops: 100,
      gold: 0n,
      cities: 0,
      ports: 0,
      factories: 0,
      allies: [],
      enemies: [],
      capitalThreatened: false,
      capitalEncircled: false,
    }) as any;

  it("derives border and defensive milestones from an active breach", () => {
    expect(
      deriveNationalMilestones({
        summary: summary(0.8, "nation-1"),
        hasActiveIncomingAttack: true,
        isAlive: true,
      }),
    ).toEqual([
      NationalEventType.BorderBreached,
      NationalEventType.DefensiveLineBroken,
    ]);
  });

  it("derives major-region, displacement, and occupation milestones", () => {
    expect(
      deriveNationalMilestones({
        summary: summary(0.2, "attacker"),
        hasActiveIncomingAttack: false,
        isAlive: true,
      }),
    ).toEqual([
      NationalEventType.GovernmentDisplaced,
      NationalEventType.NationOccupied,
    ]);
    expect(
      deriveNationalMilestones({
        summary: summary(1, "nation-1"),
        hasActiveIncomingAttack: false,
        isAlive: true,
        territoryGained: 10,
        regionThreshold: 5,
      }),
    ).toEqual([NationalEventType.MajorRegionSecured]);
  });
});

describe("deriveOccupationResistance", () => {
  it("increases with territorial loss and capital pressure", () => {
    const stable = deriveOccupationResistance({
      territoryFraction: 1,
      capitalOwned: true,
      capitalThreatened: false,
      capitalEncircled: false,
      hasActiveIncomingAttack: false,
    });
    const pressured = deriveOccupationResistance({
      territoryFraction: 0.4,
      capitalOwned: false,
      capitalThreatened: true,
      capitalEncircled: true,
      hasActiveIncomingAttack: true,
    });
    expect(stable).toBe(0);
    expect(pressured).toBe(81);
  });

  it("clamps the modifier to the national range", () => {
    expect(
      deriveOccupationResistance({
        territoryFraction: 0,
        capitalOwned: false,
        capitalThreatened: true,
        capitalEncircled: true,
        hasActiveIncomingAttack: true,
      }),
    ).toBe(100);
  });
});

describe("advanceOccupationResistance", () => {
  it("retains instability after recapture and recovers gradually", () => {
    expect(advanceOccupationResistance(null, 81, true)).toBe(81);
    expect(advanceOccupationResistance(20, 80, false)).toBe(28);
    expect(advanceOccupationResistance(80, 20, true)).toBe(78);
    expect(advanceOccupationResistance(2, 0, true)).toBe(0);
  });
});

describe("deriveOverextension", () => {
  it("grows with expansion and active commitments", () => {
    expect(
      deriveOverextension({
        territoryTiles: 100,
        baselineTerritoryTiles: 100,
        activeOutgoingAttacks: 0,
        committedTroops: 0,
        troopCapacity: 100,
      }),
    ).toBe(0);
    expect(
      deriveOverextension({
        territoryTiles: 200,
        baselineTerritoryTiles: 100,
        activeOutgoingAttacks: 2,
        committedTroops: 50,
        troopCapacity: 100,
      }),
    ).toBe(79);
  });
});

describe("deriveSupply and advanceWarExhaustion", () => {
  it("reduces supply under occupation and active front pressure", () => {
    expect(
      deriveSupply({
        territoryFraction: 1,
        capitalThreatened: false,
        capitalEncircled: false,
        activeIncomingAttacks: 0,
        activeOutgoingAttacks: 0,
        committedTroops: 0,
        troopCapacity: 100,
      }),
    ).toBe(100);
    expect(
      deriveSupply({
        territoryFraction: 0.5,
        capitalThreatened: true,
        capitalEncircled: true,
        activeIncomingAttacks: 4,
        activeOutgoingAttacks: 5,
        committedTroops: 80,
        troopCapacity: 100,
      }),
    ).toBe(0);
  });

  it("accumulates during war and recovers during peace", () => {
    expect(advanceWarExhaustion(0, true, 30, 0.1)).toBe(3);
    expect(advanceWarExhaustion(50, false, 100, 0)).toBe(49);
  });
});

describe("deriveNationalProductionModifier", () => {
  it("keeps a sovereign nation at full output and burdens occupied fronts", () => {
    expect(
      deriveNationalProductionModifier({
        territoryFraction: 1,
        activeIncomingAttacks: 0,
        activeOutgoingAttacks: 0,
      }),
    ).toBe(1);
    expect(
      deriveNationalProductionModifier({
        territoryFraction: 0.4,
        activeIncomingAttacks: 2,
        activeOutgoingAttacks: 2,
      }),
    ).toBe(0.57);
    expect(
      deriveNationalProductionModifier({
        territoryFraction: 0.4,
        activeIncomingAttacks: 2,
        activeOutgoingAttacks: 2,
        industrialRegions: 4,
        majorCities: 2,
      }),
    ).toBe(0.66);
    expect(
      deriveNationalProductionModifier({
        territoryFraction: 1,
        activeIncomingAttacks: 0,
        activeOutgoingAttacks: 0,
        warExhaustion: 100,
      }),
    ).toBe(0.85);
    expect(
      deriveNationalProductionModifier({
        territoryFraction: 1,
        activeIncomingAttacks: 0,
        activeOutgoingAttacks: 0,
        capitalThreatened: true,
        capitalEncircled: true,
        capitalOccupied: true,
        occupationResistance: 100,
      }),
    ).toBe(0.7);
  });
});

describe("deriveStrategicLocations", () => {
  it("exposes capital, city, port, and industrial locations", () => {
    const nation = {
      id: () => "nation-1",
      units: (type: string) => {
        const tiles = type === "City" ? [10] : type === "Port" ? [11] : [12];
        return tiles.map((tile, index) => ({
          id: () => index + 1,
          tile: () => tile,
        }));
      },
    } as any;
    const owner = { isPlayer: () => true, id: () => "nation-1" } as any;
    expect(
      deriveStrategicLocations(nation, owner, 4).map(
        (location) => location.type,
      ),
    ).toEqual([
      "capital",
      "major_city",
      "port",
      "industrial_region",
      "logistics_hub",
    ]);
  });
});

describe("deriveGeographicLocations", () => {
  it("identifies topology-driven chokepoints, crossings, and islands", () => {
    const player = {
      id: () => "nation-1",
      borderTiles: () => [1, 3],
      isFriendly: (other: any) => other.id() === "nation-1",
    } as any;
    const enemy = { isPlayer: () => true, id: () => "enemy" };
    const own = { isPlayer: () => true, id: () => "nation-1" };
    const empty = { isPlayer: () => false };
    const game = {
      neighbors4: (tile: number, out: number[]) => {
        const neighbors = tile === 1 ? [0, 2, 4] : [5, 6, 7];
        neighbors.forEach((neighbor, index) => (out[index] = neighbor));
        return neighbors.length;
      },
      isLand: (tile: number) => [0, 2, 3, 4].includes(tile),
      isShore: (tile: number) => tile === 3,
      owner: (tile: number) => {
        if (tile === 0 || tile === 4) return enemy;
        if (tile === 2 || tile === 3) return own;
        return empty;
      },
    } as any;
    expect(
      deriveGeographicLocations(game, player).map((location) => location.type),
    ).toEqual([
      StrategicLocationType.Chokepoint,
      StrategicLocationType.Crossing,
      StrategicLocationType.StrategicIsland,
    ]);
  });
});

describe("NationalFramingTracker liberation state", () => {
  it("surfaces a liberation attempt once resistance is established", async () => {
    const game = await setup("big_plains", {}, [
      new PlayerInfo("Liberator", PlayerType.Human, null, "liberator"),
      new PlayerInfo("Occupier", PlayerType.Human, null, "occupier"),
    ]);
    const liberator = game.player("liberator");
    const occupier = game.player("occupier");
    const capital = game.ref(50, 50);
    const reserve = game.ref(51, 50);
    liberator.conquer(capital);
    liberator.conquer(reserve);
    liberator.setSpawnTile(capital);
    const tracker = new NationalFramingTracker(game);

    tracker.evaluate();
    occupier.conquer(capital);
    const capture = tracker.evaluate();
    expect(
      capture.events.find(
        (event) => event.event === NationalEventType.CapitalCaptured,
      )?.relatedNationID,
    ).toBe(occupier.id());
    for (let i = 0; i < 3; i++) tracker.evaluate();
    vi.spyOn(liberator, "outgoingAttacks").mockReturnValue([
      {
        isActive: () => true,
        troops: () => 100,
        target: () => occupier,
      } as never,
    ]);

    const attempt = tracker.evaluate();
    expect(
      attempt.events.filter(
        (event) => event.event === NationalEventType.LiberationAttempted,
      ),
    ).toHaveLength(1);
    expect(tracker.evaluate().events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: NationalEventType.LiberationAttempted,
        }),
      ]),
    );
  });

  it("retains liberated authority after a capital is recaptured", async () => {
    const game = await setup("big_plains", {}, [
      new PlayerInfo("Liberator", PlayerType.Human, null, "liberator"),
      new PlayerInfo("Occupier", PlayerType.Human, null, "occupier"),
    ]);
    const liberator = game.player("liberator");
    const occupier = game.player("occupier");
    const capital = game.ref(50, 50);
    const reserve = game.ref(51, 50);
    liberator.conquer(capital);
    liberator.conquer(reserve);
    liberator.setSpawnTile(capital);
    const tracker = new NationalFramingTracker(game);

    tracker.evaluate();
    occupier.conquer(capital);
    tracker.evaluate();
    liberator.conquer(capital);
    const recapture = tracker.evaluate();

    const recapturedState = recapture.states.find(
      (state) => state.nationID === liberator.id(),
    );
    expect(recapturedState?.authorityState).toBe(AuthorityState.Liberated);
    expect(recapturedState?.occupationResistance).toBeGreaterThan(0);
    expect(
      recapture.events.some(
        (event) =>
          event.nationID === liberator.id() &&
          event.event === NationalEventType.NationLiberated,
      ),
    ).toBe(true);

    game.executeNextTick();
    const next = tracker.evaluate();
    const nextState = next.states.find(
      (state) => state.nationID === liberator.id(),
    );
    expect(nextState?.authorityState).toBe(AuthorityState.Liberated);
    expect(nextState?.occupationResistance).toBeLessThan(
      recapturedState?.occupationResistance ?? 0,
    );
    expect(nextState?.occupationResistance).toBeGreaterThan(0);
  });
});
