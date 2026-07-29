import { PlayerExecution } from "../../../src/core/execution/PlayerExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

let game: Game;
let player: Player;
let otherPlayer: Player;

describe("PlayerExecution", () => {
  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("player", PlayerType.Human, "client_id1", "player_id"),
        new PlayerInfo("other", PlayerType.Human, "client_id2", "other_id"),
      ],
    );

    player = game.player("player_id");
    otherPlayer = game.player("other_id");

    game.addExecution(new PlayerExecution(player));
    game.addExecution(new PlayerExecution(otherPlayer));
  });

  test("DefensePost lv. 1 is destroyed when tile owner changes", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const defensePost = player.buildUnit(UnitType.DefensePost, tile, {});

    game.executeNextTick();
    expect(game.unitCount(UnitType.DefensePost)).toBe(1);
    expect(defensePost.level()).toBe(1);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(game.unitCount(UnitType.DefensePost)).toBe(0);
  });

  test("DefensePost lv. 2+ is destroyed when tile owner changes", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const defensePost = player.buildUnit(UnitType.DefensePost, tile, {});
    defensePost.increaseLevel();

    expect(defensePost.level()).toBe(2);
    expect(game.unitCount(UnitType.DefensePost)).toBe(2); // unitCount sums levels
    expect(player.units(UnitType.DefensePost)).toHaveLength(1);
    expect(defensePost.isActive()).toBe(true);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(game.unitCount(UnitType.DefensePost)).toBe(0);
    expect(defensePost.isActive()).toBe(false);
  });

  test("Non-DefensePost structures are transferred (not downgraded) when tile owner changes", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const city = player.buildUnit(UnitType.City, tile, {});

    expect(game.unitCount(UnitType.City)).toBe(1);
    expect(city.level()).toBe(1);
    expect(city.owner()).toBe(player);
    expect(city.isActive()).toBe(true);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(game.unitCount(UnitType.City)).toBe(1);
    expect(city.level()).toBe(1);
    expect(city.owner()).toBe(otherPlayer);
    expect(city.isActive()).toBe(true);
  });

  test("human national production reflects territorial loss", () => {
    const firstTile = game.ref(50, 50);
    const secondTile = game.ref(51, 50);
    player.conquer(firstTile);
    player.conquer(secondTile);

    const execution = new PlayerExecution(player);
    execution.init(game, 0);
    player.setTroops(0);
    player.relinquish(secondTile);

    const unrestrictedIncome = game.config().troopIncreaseRate(player);
    execution.tick(10);

    expect(player.troops()).toBeLessThan(unrestrictedIncome);
  });

  test("a nation surrenders its negligible remnant to a hostile neighbor", async () => {
    const nationGame = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("captor", PlayerType.Human, "captor_client", "captor_id"),
        new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
      ],
    );
    const captor = nationGame.player("captor_id");
    const nation = nationGame.player("nation_id");
    const land: number[] = [];
    nationGame.map().forEachTile((tile) => {
      if (nationGame.map().isLand(tile) && land.length < 150) land.push(tile);
    });

    for (const tile of land) captor.conquer(tile);
    for (const tile of land.slice(0, 150)) nation.conquer(tile);

    const execution = new PlayerExecution(nation);
    nationGame.addExecution(execution);
    nationGame.executeNextTick();

    for (const tile of land.slice(0, 100)) captor.conquer(tile);
    nationGame.executeNextTick();

    expect(nation.numTilesOwned()).toBe(0);
    expect(captor.numTilesOwned()).toBeGreaterThanOrEqual(land.length);
  });
});
