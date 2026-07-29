import { renderNumber } from "../../client/Utils";
import {
  Execution,
  Game,
  MessageType,
  Player,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { MotionPlanRecord } from "../game/MotionPlans";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";

const CONVOY_CAPTURE_REWARD = 250_000n;

/** Moves a temporary supply boost between two friendly ports. */
export class SupplyConvoyExecution implements Execution {
  private active = true;
  private mg: Game;
  private pathFinder: WaterPathFinder;
  private convoy: Unit | undefined;
  private lastMove = 0;
  private motionPlanId = 1;
  private motionPlanDst: TileRef | null = null;
  private lossRecorded = false;

  constructor(
    private readonly origOwner: Player,
    private readonly srcPort: Unit,
    private readonly dstPort: Unit,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.lastMove = ticks;
    this.pathFinder = new WaterPathFinder(
      mg,
      ticks % WaterPathFinder.STAGGER_SPREAD,
    );
  }

  tick(ticks: number): void {
    if (this.convoy === undefined) {
      if (
        !this.srcPort.isActive() ||
        !this.dstPort.isActive() ||
        this.srcPort.owner() !== this.origOwner ||
        this.dstPort.owner() !== this.origOwner
      ) {
        this.recordLoss();
        this.active = false;
        return;
      }
      const spawn = this.origOwner.canBuild(
        UnitType.SupplyConvoy,
        this.srcPort.tile(),
      );
      if (spawn === false) {
        this.recordLoss();
        this.active = false;
        return;
      }
      this.convoy = this.origOwner.buildUnit(UnitType.SupplyConvoy, spawn, {
        targetUnit: this.dstPort,
      });
      this.recordMotionPlan(ticks, this.convoy.tile(), this.dstPort.tile());
      return;
    }

    if (!this.convoy.isActive()) {
      this.recordLoss();
      this.active = false;
      return;
    }

    const convoyOwner = this.convoy.owner();
    if (convoyOwner !== this.origOwner) {
      convoyOwner.addGold(CONVOY_CAPTURE_REWARD, this.convoy.tile());
      this.mg.displayMessage(
        "events_display.supply_convoy_captured",
        MessageType.CAPTURED_ENEMY_UNIT,
        convoyOwner.id(),
        CONVOY_CAPTURE_REWARD,
        { gold: renderNumber(CONVOY_CAPTURE_REWARD), name: this.origOwner.displayName() },
        this.convoy.id(),
      );
      this.recordLoss();
      this.convoy.delete(false);
      this.active = false;
      return;
    }

    if (!this.dstPort.isActive() || this.dstPort.owner() !== this.origOwner) {
      this.convoy.delete(false);
      this.recordLoss();
      this.active = false;
      return;
    }

    if (ticks - this.lastMove < 1) return;
    this.lastMove = ticks;
    const result = this.pathFinder.next(this.convoy.tile(), this.dstPort.tile());
    switch (result.status) {
      case PathStatus.COMPLETE:
        this.mg.recordSupplyConvoyArrival(this.origOwner);
        this.mg.displayMessage(
          "events_display.supply_convoy_arrived",
          MessageType.SUPPLY_CONVOY_ARRIVED,
          this.origOwner.id(),
          undefined,
          { name: this.dstPort.owner().displayName() },
          this.convoy.id(),
        );
        this.convoy.delete(false);
        this.active = false;
        return;
      case PathStatus.NEXT:
        this.convoy.move(result.node);
        if (this.dstPort.tile() !== this.motionPlanDst) {
          this.recordMotionPlan(ticks, this.convoy.tile(), this.dstPort.tile());
        }
        return;
      case PathStatus.NOT_FOUND:
        this.convoy.delete(false);
        this.recordLoss();
        this.active = false;
        return;
    }
  }

  private recordMotionPlan(ticks: number, from: TileRef, to: TileRef): void {
    const path = this.pathFinder.findPath(from, to) ?? [from];
    const motionPlan: MotionPlanRecord = {
      kind: "grid",
      unitId: this.convoy!.id(),
      planId: this.motionPlanId++,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: path.length > 0 ? path : [from],
    };
    this.mg.recordMotionPlan(motionPlan);
    this.motionPlanDst = to;
  }

  private recordLoss(): void {
    if (this.lossRecorded) return;
    this.lossRecorded = true;
    this.mg.recordSupplyConvoyLoss(this.origOwner);
    this.mg.displayMessage(
      "events_display.supply_convoy_lost",
      MessageType.SUPPLY_CONVOY_LOST,
      this.origOwner.id(),
    );
  }

  owner(): Player {
    return this.origOwner;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
