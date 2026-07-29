import { describe, expect, it } from "vitest";
import {
  FactionEventType,
  FactionFramingTracker,
  deriveFactionSummaries,
} from "../src/core/game/FactionFraming";
import { GameMode, PlayerType, UnitType } from "../src/core/game/Game";

function player(id: string, team: string | null, tiles: number, troops: number) {
  return {
    id: () => id,
    displayName: () => id,
    team: () => team,
    type: () => PlayerType.Nation,
    isAlive: () => true,
    numTilesOwned: () => tiles,
    troops: () => troops,
    outgoingAttacks: () => [],
  } as never;
}

describe("deriveFactionSummaries", () => {
  it("groups team members and exposes a read-only objective", () => {
    const red = player("red-1", "Red", 60, 100);
    const blue = player("blue-1", "Blue", 40, 80);
    const game = {
      allPlayers: () => [red, blue],
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.Team }),
        percentageTilesOwnedToWin: () => 95,
      }),
    } as never;

    expect(deriveFactionSummaries(game)).toMatchObject([
      {
        factionID: "team:Red",
        members: ["red-1"],
        territoryFraction: 0.6,
        victoryProgress: 0.63,
        objective: "consolidate_control",
      },
      {
        factionID: "team:Blue",
        territoryFraction: 0.4,
        objective: "consolidate_control",
      },
    ]);
  });

  it("groups connected FFA alliances into a shared coalition", () => {
    const alpha = player("alpha", null, 35, 100) as any;
    const beta = player("beta", null, 25, 80) as any;
    alpha.isAlliedWith = (other: any) => other === beta;
    beta.isAlliedWith = (other: any) => other === alpha;
    const game = {
      allPlayers: () => [alpha, beta],
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        percentageTilesOwnedToWin: () => 80,
      }),
    } as never;

    expect(deriveFactionSummaries(game)).toMatchObject([
      {
        factionID: "coalition:alpha+beta",
        label: "alpha Coalition",
        members: ["alpha", "beta"],
        territoryTiles: 60,
        territoryFraction: 0.6,
        troops: 180,
      },
    ]);
  });

  it("emits coalition formation and dissolution events", () => {
    const alpha = player("alpha", null, 35, 100) as any;
    const beta = player("beta", null, 25, 80) as any;
    let allied = false;
    alpha.isAlliedWith = () => allied;
    beta.isAlliedWith = () => allied;
    const game = {
      allPlayers: () => [alpha, beta],
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        percentageTilesOwnedToWin: () => 80,
      }),
    } as never;
    const tracker = new FactionFramingTracker(game);

    tracker.evaluate();
    allied = true;
    expect(tracker.evaluate().events).toMatchObject([
      { event: FactionEventType.CoalitionFormed },
    ]);
    allied = false;
    expect(tracker.evaluate().events).toMatchObject([
      { event: FactionEventType.CoalitionDisbanded },
    ]);
  });

  it("emits a victory-ready milestone without setting a winner", () => {
    const state = { tiles: 60 };
    const red = player("red-1", null, state.tiles, 100);
    const blue = player("blue-1", null, 40, 80);
    const game = {
      allPlayers: () => [red, blue],
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        percentageTilesOwnedToWin: () => 80,
      }),
    } as never;
    const tracker = new FactionFramingTracker(game);
    tracker.evaluate();
    state.tiles = 80;
    (red as { numTilesOwned: () => number }).numTilesOwned = () => state.tiles;
    expect(tracker.evaluate().events).toMatchObject([
      { event: FactionEventType.VictoryReady, factionID: "nation:red-1" },
    ]);
  });

  it("attaches an enemy capital target to a breakthrough objective", () => {
    const red = player("red-1", null, 60, 100) as any;
    const blue = player("blue-1", null, 40, 80) as any;
    red.isPlayer = () => true;
    blue.isPlayer = () => true;
    red.spawnTile = () => 11;
    blue.spawnTile = () => 99;
    red.outgoingAttacks = () => [
      { isActive: () => true, target: () => blue },
    ];
    let objectiveOwner = blue;
    const game = {
      allPlayers: () => [red, blue],
      owner: () => objectiveOwner,
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        percentageTilesOwnedToWin: () => 80,
      }),
    } as never;

    expect(deriveFactionSummaries(game)[0]).toMatchObject({
      objective: "breakthrough",
      objectiveTile: 99,
      objectiveLocationType: "capital",
      objectiveSecured: false,
    });
    objectiveOwner = red;
    expect(deriveFactionSummaries(game)[0].objectiveSecured).toBe(true);
  });

  it("targets an owned industrial region while consolidating control", () => {
    const red = player("red-1", null, 60, 100) as any;
    const blue = player("blue-1", null, 40, 80) as any;
    red.isPlayer = () => true;
    blue.isPlayer = () => true;
    red.units = (type: UnitType) =>
      type === UnitType.Factory ? [{ tile: () => 42 }] : [];
    const game = {
      allPlayers: () => [red, blue],
      owner: () => red,
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        percentageTilesOwnedToWin: () => 95,
      }),
    } as never;

    expect(deriveFactionSummaries(game)[0]).toMatchObject({
      objective: "consolidate_control",
      objectiveTile: 42,
      objectiveLocationType: "industrial_region",
    });
  });

  it("emits an objective-secured event when a frontier target is taken", () => {
    const red = player("red-1", null, 30, 100) as any;
    const blue = player("blue-1", null, 70, 80) as any;
    red.isPlayer = () => true;
    red.borderTiles = () => [1];
    red.outgoingAttacks = () => [
      { isActive: () => true, target: () => blue },
    ];
    blue.isPlayer = () => true;
    let owner: any = blue;
    const game = {
      allPlayers: () => [red, blue],
      owner: () => owner,
      numLandTiles: () => 100,
      config: () => ({
        gameConfig: () => ({ gameMode: GameMode.FFA }),
        percentageTilesOwnedToWin: () => 80,
      }),
    } as never;
    const tracker = new FactionFramingTracker(game);
    tracker.evaluate();
    owner = red;
    expect(tracker.evaluate().events).toMatchObject([
      {
        event: FactionEventType.ObjectiveSecured,
        factionID: "nation:red-1",
      },
    ]);
  });
});
