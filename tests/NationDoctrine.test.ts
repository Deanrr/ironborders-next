import { describe, expect, it, vi } from "vitest";
import { NationAllianceBehavior } from "../src/core/execution/nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "../src/core/execution/nation/NationEmojiBehavior";
import {
  NationDoctrine,
  nationDoctrineLabel,
  resolveNationDoctrine,
  structurePriorityForDoctrine,
} from "../src/core/game/NationDoctrine";
import { PlayerType, UnitType } from "../src/core/game/Game";
import { PseudoRandom } from "../src/core/PseudoRandom";
import { prioritizeStrategicTargets } from "../src/core/execution/utils/AiAttackBehavior";
import { playerInfo, setup } from "./util/Setup";

describe("NationDoctrine", () => {
  it("assigns a stable doctrine for a nation identifier", () => {
    const first = resolveNationDoctrine("nation-alpha");
    expect(resolveNationDoctrine("nation-alpha")).toBe(first);
    expect(Object.values(NationDoctrine)).toContain(first);
  });

  it("provides a readable label", () => {
    expect(nationDoctrineLabel(NationDoctrine.Coalitionist)).toBe(
      "Coalitionist",
    );
  });

  it("prioritizes doctrine-relevant strategic targets stably", () => {
    const portTarget = {
      unitCount: (type: UnitType) => (type === UnitType.Port ? 2 : 0),
    } as never;
    const factoryTarget = {
      unitCount: (type: UnitType) => (type === UnitType.Factory ? 3 : 0),
    } as never;
    expect(
      prioritizeStrategicTargets(
        [factoryTarget, portTarget],
        NationDoctrine.Naval,
      ),
    ).toEqual([portTarget, factoryTarget]);
    expect(
      prioritizeStrategicTargets(
        [portTarget, factoryTarget],
        NationDoctrine.Fortress,
      ),
    ).toEqual([portTarget, factoryTarget]);
  });

  it("prioritizes national structures by doctrine", () => {
    expect(structurePriorityForDoctrine(NationDoctrine.Economic)[0]).toBe(
      UnitType.Factory,
    );
    expect(structurePriorityForDoctrine(NationDoctrine.Fortress)[0]).toBe(
      UnitType.SAMLauncher,
    );
    expect(structurePriorityForDoctrine(NationDoctrine.Naval)[0]).toBe(
      UnitType.Port,
    );
    expect(structurePriorityForDoctrine(NationDoctrine.Opportunist)).toEqual(
      structurePriorityForDoctrine(),
    );
  });

  it("coalitionists support an allied nation under active attack", async () => {
    const game = await setup("plains", {
      donateTroops: true,
      infiniteTroops: false,
    });
    const donor = game.addPlayer(playerInfo("coalitionist", PlayerType.Nation));
    const ally = game.addPlayer(playerInfo("ally", PlayerType.Human));
    const enemy = game.addPlayer(playerInfo("enemy", PlayerType.Human));

    donor.conquer(game.ref(0, 0));
    ally.conquer(game.ref(0, 1));
    enemy.conquer(game.ref(0, 2));
    donor.addTroops(50_000);
    ally.addTroops(100);
    enemy.addTroops(100);

    const request = donor.createAllianceRequest(ally);
    expect(request).not.toBeNull();
    request?.accept();

    vi.spyOn(ally, "incomingAttacks").mockReturnValue([
      { attacker: () => enemy } as never,
    ]);

    const emojiBehavior = new NationEmojiBehavior(
      new PseudoRandom(42),
      game,
      donor,
    );
    const allianceBehavior = new NationAllianceBehavior(
      new PseudoRandom(42),
      game,
      donor,
      emojiBehavior,
      NationDoctrine.Coalitionist,
    );

    const donorTroopsBefore = donor.troops();
    const allyTroopsBefore = ally.troops();
    expect(allianceBehavior.supportAlliedFront()).toBe(true);
    game.executeNextTick();
    game.executeNextTick();

    expect(donor.troops()).toBeLessThan(donorTroopsBefore);
    expect(ally.troops()).toBeGreaterThan(allyTroopsBefore);
  });
});
