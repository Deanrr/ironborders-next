import {
  Execution,
  Game,
  MessageType,
  Player,
  Structures,
  TrajectoryTile,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { UniversalPathFinding } from "../pathfinding/PathFinder";
import { ParabolaUniversalPathFinder } from "../pathfinding/PathFinder.Parabola";
import { PathStatus } from "../pathfinding/types";

/** A precise, non-nuclear silo-launched structure strike. */
export class CruiseMissileExecution implements Execution {
  private active = true;
  private mg: Game;
  private missile: Unit | null = null;
  private target: Unit | null = null;
  private targetTile: TileRef | null = null;
  private src: TileRef | null = null;
  private speed = -1;
  private pathFinder: ParabolaUniversalPathFinder;

  constructor(
    private readonly player: Player,
    private readonly dst: TileRef,
  ) {}

  init(mg: Game): void {
    this.mg = mg;
    this.speed = mg.config().cruiseMissileSpeed();
    this.pathFinder = UniversalPathFinding.Parabola(mg, {
      increment: this.speed,
    });
  }

  tick(ticks: number): void {
    if (this.missile === null) {
      this.target =
        this.mg
          .nearbyUnits(
            this.dst,
            2.5,
            Structures.types,
            ({ unit }) =>
              unit.isActive() &&
              unit.owner() !== this.player &&
              !(
                unit.owner().isPlayer() &&
                this.player.isOnSameTeam(unit.owner() as Player)
              ),
          )
          .sort((a, b) => a.distSquared - b.distSquared)[0]?.unit ?? null;
      const spawn = this.player.canBuild(UnitType.CruiseMissile, this.dst);
      if (spawn === false || this.target === null) {
        this.active = false;
        return;
      }

      this.src = spawn;
      this.targetTile = this.target.tile();
      const path = this.pathFinder.findPath(this.src, this.targetTile) ?? [];
      if (path.some((tile) => this.mg.isImpassable(tile))) {
        this.active = false;
        return;
      }

      this.missile = this.player.buildUnit(UnitType.CruiseMissile, this.src, {
        targetTile: this.targetTile!,
        trajectory: this.getTrajectory(),
      });
      this.mg.recordMotionPlan({
        kind: "grid",
        unitId: this.missile.id(),
        planId: 1,
        startTick: ticks + 1,
        ticksPerStep: 1,
        path: path.length > 0 ? path : [this.src],
      });
      this.mg.displayIncomingUnit(
        this.missile.id(),
        `${this.player.displayName()} - cruise missile inbound`,
        MessageType.CRUISE_MISSILE_INBOUND,
        this.target.owner().id(),
      );
      const silo = this.player
        .units(UnitType.MissileSilo)
        .find((unit) => unit.tile() === spawn);
      silo?.launch();
      return;
    }

    if (
      !this.missile.isActive() ||
      this.target === null ||
      !this.target.isActive()
    ) {
      this.active = false;
      return;
    }
    if (this.target.owner() === this.player) {
      this.missile.delete(false);
      this.active = false;
      return;
    }

    const result = this.pathFinder.next(
      this.src!,
      this.targetTile!,
      this.speed,
    );
    if (result.status === PathStatus.COMPLETE) {
      this.detonate();
    } else if (result.status === PathStatus.NEXT) {
      this.missile.setTrajectoryIndex(this.pathFinder.currentIndex());
      this.missile.setTargetable(true);
      this.missile.move(result.node);
    }
  }

  private getTrajectory(): TrajectoryTile[] {
    const path = this.pathFinder.findPath(this.src!, this.targetTile!) ?? [];
    return path.map((tile) => ({
      tile,
      // SAMs may intercept anywhere along the flight path, not only in the
      // launch/terminal radius. Restricting this to the endpoints lets a
      // fast missile reach its target before a launcher can engage it.
      targetable: true,
    }));
  }

  private detonate(): void {
    if (this.missile === null || this.target === null) return;
    if (this.target.isActive() && this.target.owner() !== this.player) {
      this.target.delete(true, this.player);
      this.mg.displayMessage(
        "events_display.cruise_missile_detonated",
        MessageType.CRUISE_MISSILE_DETONATED,
        this.player.id(),
        undefined,
        { unit: this.target.type() },
      );
    }
    this.missile.setReachedTarget();
    this.missile.delete(false);
    this.active = false;
  }

  owner(): Player {
    return this.player;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
