import { SupplyConvoyExecution } from "../../../src/core/execution/SupplyConvoyExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

describe("SupplyConvoyExecution", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [new PlayerInfo("player", PlayerType.Human, "client_p", "player_id")],
    );
    player = game.player("player_id");
    game.config().structureMinDist = () => 1;
  });

  it("delivers a temporary logistics support effect between friendly ports", () => {
    player.conquer(game.ref(7, 10));
    const srcTile = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (srcTile === false) throw new Error("unable to build source port");
    const srcPort = player.buildUnit(UnitType.Port, srcTile, {});

    let dstTile: number | false = false;
    for (let y = 0; y < game.height() && dstTile === false; y++) {
      for (let x = 0; x < game.width() && dstTile === false; x++) {
        const candidate = game.ref(x, y);
        if (!game.isLand(candidate) || game.manhattanDist(candidate, srcTile) < 5) {
          continue;
        }
        player.conquer(candidate);
        const possible = player.canBuild(UnitType.Port, candidate);
        if (possible !== false) dstTile = possible;
      }
    }
    if (dstTile === false) throw new Error("unable to build destination port");
    const dstPort = player.buildUnit(UnitType.Port, dstTile, {});

    const arrival = vi.spyOn(game, "recordSupplyConvoyArrival");
    game.addExecution(new SupplyConvoyExecution(player, srcPort, dstPort));
    executeTicks(game, 250);

    expect(arrival).toHaveBeenCalledWith(player);
    expect(game.units(UnitType.SupplyConvoy)).toHaveLength(0);
  });
});
