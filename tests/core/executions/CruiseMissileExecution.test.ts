import { CruiseMissileExecution } from "../../../src/core/execution/CruiseMissileExecution";
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

    game.addExecution(new CruiseMissileExecution(attacker, target));
    executeTicks(game, 20);

    expect(city.isActive()).toBe(false);
    expect(attacker.numTilesOwned()).toBe(1);
    expect(defender.numTilesOwned()).toBe(1);
    expect(game.units(UnitType.CruiseMissile)).toHaveLength(0);
  });
});
