import { describe, expect, it } from "vitest";
import {
  FrontEventType,
  FrontFramingTracker,
  FrontMomentum,
} from "../src/core/game/FrontFraming";
import { PlayerType, UnitType } from "../src/core/game/Game";

function player(
  id: string,
  type: PlayerType,
  tiles: number,
  troops: number,
  attacks: unknown[] = [],
) {
  return {
    id: () => id,
    type: () => type,
    isPlayer: () => true,
    isAlive: () => true,
    numTilesOwned: () => tiles,
    troops: () => troops,
    displayName: () => id,
    outgoingAttacks: () => attacks,
    incomingAttacks: () => [],
    units: () => [],
  } as never;
}

function attack(
  attacker: any,
  defender: any,
  position: number,
  troops: number,
  sourceTile: number,
  borderSize = 10,
) {
  return {
    id: () => `${attacker.id()}-${position}`,
    isActive: () => true,
    retreated: () => false,
    target: () => defender,
    attacker: () => attacker,
    clusteredPositions: () => [position],
    sourceTile: () => sourceTile,
    troops: () => troops,
    borderSize: () => borderSize,
  } as never;
}

describe("FrontFramingTracker", () => {
  it("groups nearby attacks into a stable front and separates distant clusters", () => {
    const attacker = player("a", PlayerType.Nation, 100, 100);
    const defender = player("d", PlayerType.Nation, 100, 100);
    const attacks = [
      attack(attacker, defender, 10, 20, 0),
      attack(attacker, defender, 20, 30, 0),
      attack(attacker, defender, 200, 40, 190),
    ];
    (attacker as { outgoingAttacks: () => unknown[] }).outgoingAttacks = () =>
      attacks;
    const game = {
      allPlayers: () => [attacker, defender],
      x: (tile: number) => tile,
      y: () => 0,
    } as never;

    const tracker = new FrontFramingTracker(game);
    const first = tracker.evaluate();
    expect(first).toHaveLength(2);
    expect(first[0].positions).toHaveLength(2);
    expect(first[0].troopsCommitted).toBe(50);
    expect(first[0].territoryGained).toBe(0);
    expect(first[0].territoryLost).toBe(0);
    expect(tracker.drainEvents()).toHaveLength(2);

    const ids = first.map((front) => front.frontID);
    const second = tracker.evaluate();
    expect(second.map((front) => front.frontID)).toEqual(ids);
    expect(
      tracker
        .drainEvents()
        .every((event) => event.event === FrontEventType.MomentumChanged),
    ).toBe(true);

    (attacker as { outgoingAttacks: () => unknown[] }).outgoingAttacks =
      () => [];
    expect(tracker.evaluate()).toEqual([]);
    expect(tracker.drainEvents().map((event) => event.event)).toEqual([
      FrontEventType.Ended,
      FrontEventType.Ended,
    ]);
  });

  it("reports a breakthrough when the defender loses territory under pressure", () => {
    const state = { attackerTiles: 100, defenderTiles: 100 };
    const attacker = player("a", PlayerType.Nation, state.attackerTiles, 100);
    const defender = player("d", PlayerType.Nation, state.defenderTiles, 20);
    const currentAttack = attack(attacker, defender, 10, 80, 0);
    (attacker as { outgoingAttacks: () => unknown[] }).outgoingAttacks = () => [
      currentAttack,
    ];
    const game = {
      allPlayers: () => [attacker, defender],
      x: (tile: number) => tile,
      y: () => 0,
    } as never;
    const tracker = new FrontFramingTracker(game);
    tracker.evaluate();
    tracker.drainEvents();

    state.defenderTiles = 90;
    (defender as { numTilesOwned: () => number }).numTilesOwned = () =>
      state.defenderTiles;
    const updated = tracker.evaluate()[0];
    expect(updated.momentum).toBe(FrontMomentum.Breakthrough);
    expect(updated.territoryLost).toBe(10);
    expect(tracker.drainEvents()[0].momentum).toBe(FrontMomentum.Breakthrough);
  });

  it("frames wars between human-commanded nations", () => {
    const humanA = player("a", PlayerType.Human, 100, 100);
    const humanB = player("b", PlayerType.Human, 100, 100);
    const currentAttack = attack(humanA, humanB, 10, 80, 0);
    (humanA as { outgoingAttacks: () => unknown[] }).outgoingAttacks = () => [
      currentAttack,
    ];
    const game = {
      allPlayers: () => [humanA, humanB],
      x: (tile: number) => tile,
      y: () => 0,
    } as never;
    const fronts = new FrontFramingTracker(game).evaluate();
    expect(fronts).toHaveLength(1);
    expect(fronts[0].attackerID).toBe("a");
    expect(fronts[0].defenderID).toBe("b");
  });

  it("infers advance direction for land attacks without a source tile", () => {
    const attacker = player("a", PlayerType.Nation, 100, 100);
    const defender = player("d", PlayerType.Nation, 100, 100);
    const currentAttack = attack(
      attacker,
      defender,
      11,
      80,
      null as never,
    );
    (attacker as { outgoingAttacks: () => unknown[] }).outgoingAttacks = () => [
      currentAttack,
    ];
    const game = {
      allPlayers: () => [attacker, defender],
      x: (tile: number) => tile % 10,
      y: (tile: number) => Math.floor(tile / 10),
      neighbors4: (tile: number, out: number[]) => {
        out[0] = tile - 1;
        out[1] = tile + 1;
        out[2] = tile - 10;
        out[3] = tile + 10;
        return 4;
      },
      owner: (tile: number) =>
        tile === 10
          ? attacker
          : tile === 11
            ? defender
            : ({ isPlayer: () => false } as never),
    } as never;

    const front = new FrontFramingTracker(game).evaluate()[0];
    expect(front.directionX).toBeGreaterThan(0);
    expect(Math.abs(front.directionY)).toBeLessThan(0.01);
  });

  it("reduces front pressure for nearby completed defensive structures", () => {
    const attacker = player("a", PlayerType.Nation, 100, 20);
    const defender = player("d", PlayerType.Nation, 100, 80);
    const currentAttack = attack(attacker, defender, 11, 80, 0);
    (attacker as { outgoingAttacks: () => unknown[] }).outgoingAttacks = () => [
      currentAttack,
    ];
    (defender as { units: (type?: UnitType) => unknown[] }).units = (
      type?: UnitType,
    ) =>
      type === UnitType.DefensePost
        ? [
            {
              id: () => 1,
              isUnderConstruction: () => false,
              tile: () => 11,
            },
          ]
        : [];
    const game = {
      allPlayers: () => [attacker, defender],
      x: (tile: number) => tile % 10,
      y: (tile: number) => Math.floor(tile / 10),
    } as never;

    const front = new FrontFramingTracker(game).evaluate()[0];
    expect(front.pressure).toBeCloseTo(0.45);
  });

  it("tempers front pressure when the attacking nation has lower supply", () => {
    const attacker = player("a", PlayerType.Nation, 100, 20);
    const defender = player("d", PlayerType.Nation, 100, 80);
    const currentAttack = attack(attacker, defender, 11, 80, 0);
    (attacker as { outgoingAttacks: () => unknown[] }).outgoingAttacks = () => [
      currentAttack,
    ];
    (defender as { incomingAttacks: () => unknown[] }).incomingAttacks = () => [
      currentAttack,
    ];
    const game = {
      allPlayers: () => [attacker, defender],
      x: (tile: number) => tile,
      y: () => 0,
      config: () => ({ maxTroops: () => 100 }),
    } as never;

    const front = new FrontFramingTracker(game).evaluate()[0];
    expect(front.pressure).toBeLessThan(0.5);
    expect(front.pressure).toBeGreaterThan(0.44);
  });
});
