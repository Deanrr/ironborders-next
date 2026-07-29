import { CruiseMissileExecution } from "../../../src/core/execution/CruiseMissileExecution";
import { SAMLauncherExecution } from "../../../src/core/execution/SAMLauncherExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

describe("CruiseMissileExecution", () => {
  let game: Game;
  let attacker: Player;
  let defender: Player;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("attacker", PlayerType.Human, "client_a", "attacker_id"),
        new PlayerInfo("defender", PlayerType.Human, "client_d", "defender_id"),
      ],
    );
    attacker = game.player("attacker_id");
    defender = game.player("defender_id");
  });

  it("destroys exactly the targeted enemy structure without territorial damage", () => {
    const source = game.ref(2, 2);
    const target = game.ref(18, 18);
    attacker.conquer(source);
    defender.conquer(target);
    attacker.buildUnit(UnitType.MissileSilo, source, {});
    const city = defender.buildUnit(UnitType.City, target, {});

    const emptyTarget = game.ref(12, 12);
    expect(
      attacker.buildableUnits(emptyTarget, [UnitType.CruiseMissile])[0]
        .canBuild,
    ).toBe(false);
    expect(
      attacker.buildableUnits(target, [UnitType.CruiseMissile])[0].canBuild,
    ).toBe(source);

    // Click one tile beside the city to exercise the forgiving target hitbox.
    game.addExecution(new CruiseMissileExecution(attacker, game.ref(17, 17)));
    executeTicks(game, 20);

    expect(city.isActive()).toBe(false);
    expect(attacker.numTilesOwned()).toBe(1);
    expect(defender.numTilesOwned()).toBe(1);
    expect(game.units(UnitType.CruiseMissile)).toHaveLength(0);
  });

  it("can be intercepted by a SAM before reaching the target", () => {
    const source = game.ref(2, 2);
    const samTile = game.ref(18, 18);
    const target = game.ref(30, 30);
    attacker.conquer(source);
    defender.conquer(samTile);
    defender.conquer(target);
    attacker.buildUnit(UnitType.MissileSilo, source, {});
    const city = defender.buildUnit(UnitType.City, target, {});
    const sam = defender.buildUnit(UnitType.SAMLauncher, samTile, {});

    game.addExecution(new SAMLauncherExecution(defender, null, sam));
    game.addExecution(new CruiseMissileExecution(attacker, target));
    executeTicks(game, 80);

    expect(city.isActive()).toBe(true);
    expect(game.units(UnitType.CruiseMissile)).toHaveLength(0);
  });
});
