import type { AllPlayersStats } from "../Schemas";
import type { Player, PlayerID } from "./Game";
import { FrontEventType, type FrontEvent } from "./FrontFraming";
import {
  NationalEventType,
  type NationalEventSnapshot,
  type NationalStateSnapshot,
} from "./NationalFraming";

export interface ChroniclePlayerSummary {
  frontsWon: number;
  frontsLost: number;
  capitalsCaptured: number;
  nationsLiberated: number;
  nationsEliminated: number;
  strategicLocationsSecured: number;
  territoryGained: number;
  territoryLost: number;
  lowestSupply: number;
  peakOverextension: number;
  maximumWarExhaustion: number;
  unitsConstructed: number;
  unitsDestroyed: number;
  unitsCaptured: number;
}

export interface CampaignDebrief extends ChroniclePlayerSummary {
  placement: number;
  durationTicks: number;
  experienceEarned: number;
  victory: boolean;
}

const emptySummary = (): ChroniclePlayerSummary => ({
  frontsWon: 0,
  frontsLost: 0,
  capitalsCaptured: 0,
  nationsLiberated: 0,
  nationsEliminated: 0,
  strategicLocationsSecured: 0,
  territoryGained: 0,
  territoryLost: 0,
  lowestSupply: 1,
  peakOverextension: 0,
  maximumWarExhaustion: 0,
  unitsConstructed: 0,
  unitsDestroyed: 0,
  unitsCaptured: 0,
});

export class MatchChronicle {
  private readonly summaries = new Map<PlayerID, ChroniclePlayerSummary>();

  private summary(playerID: PlayerID): ChroniclePlayerSummary {
    let summary = this.summaries.get(playerID);
    if (!summary) {
      summary = emptySummary();
      this.summaries.set(playerID, summary);
    }
    return summary;
  }

  recordTerritoryChange(previous: Player | null, next: Player): void {
    if (previous && previous !== next) {
      this.summary(previous.id()).territoryLost++;
    }
    if (!previous || previous !== next) {
      this.summary(next.id()).territoryGained++;
    }
  }

  recordFrontEvent(event: FrontEvent): void {
    if (event.event !== FrontEventType.Ended) return;
    this.summary(event.attackerID).frontsWon++;
    this.summary(event.defenderID).frontsLost++;
  }

  recordNationalState(state: NationalStateSnapshot): void {
    const summary = this.summary(state.nationID);
    summary.lowestSupply = Math.min(summary.lowestSupply, state.supply);
    summary.peakOverextension = Math.max(
      summary.peakOverextension,
      state.overextension,
    );
    summary.maximumWarExhaustion = Math.max(
      summary.maximumWarExhaustion,
      state.warExhaustion,
    );
  }

  recordNationalEvent(event: NationalEventSnapshot): void {
    const responsible = event.relatedNationID ?? event.nationID;
    const summary = this.summary(responsible);
    switch (event.event) {
      case NationalEventType.CapitalCaptured:
        summary.capitalsCaptured++;
        break;
      case NationalEventType.NationLiberated:
        summary.nationsLiberated++;
        break;
      case NationalEventType.NationEliminated:
        summary.nationsEliminated++;
        break;
      case NationalEventType.StrategicLocationCaptured:
      case NationalEventType.StrategicLocationSecured:
        summary.strategicLocationsSecured++;
        break;
    }
  }

  summaryFor(player: Player, stats?: AllPlayersStats): ChroniclePlayerSummary {
    const base = { ...emptySummary(), ...(this.summaries.get(player.id()) ?? {}) };
    const clientID = player.clientID();
    const playerStats = clientID === null ? undefined : stats?.[clientID];
    const units = playerStats?.units;
    if (units) {
      for (const values of Object.values(units)) {
        base.unitsConstructed += Number(values[0] ?? 0n);
        base.unitsDestroyed += Number(values[1] ?? 0n) + Number(values[3] ?? 0n);
        base.unitsCaptured += Number(values[2] ?? 0n);
      }
    }
    return base;
  }

  buildDebriefs(
    players: readonly Player[],
    stats: AllPlayersStats,
    durationTicks: number,
    winnerID: PlayerID | null,
  ): Record<PlayerID, CampaignDebrief> {
    const contenders = players.filter((player) => player.clientID() !== null);
    const ranked = [...contenders].sort((a, b) => {
      const aStats = a.clientID() === null ? undefined : stats[a.clientID()!];
      const bStats = b.clientID() === null ? undefined : stats[b.clientID()!];
      const aDeath = aStats?.deathPosition ?? Number.MAX_SAFE_INTEGER;
      const bDeath = bStats?.deathPosition ?? Number.MAX_SAFE_INTEGER;
      if (aDeath !== bDeath) return aDeath - bDeath;
      return b.numTilesOwned() - a.numTilesOwned();
    });
    const placement = new Map(ranked.map((player, index) => [player.id(), index + 1]));
    const result: Record<PlayerID, CampaignDebrief> = {};
    for (const player of contenders) {
      const summary = this.summaryFor(player, stats);
      const experienceEarned =
        100 +
        summary.frontsWon * 100 +
        summary.capitalsCaptured * 150 +
        summary.strategicLocationsSecured * 50 +
        summary.nationsLiberated * 120 +
        summary.nationsEliminated * 100 +
        (winnerID === player.id() ? 250 : 0);
      result[player.id()] = {
        ...summary,
        placement: placement.get(player.id()) ?? contenders.length,
        durationTicks,
        experienceEarned,
        victory: winnerID === player.id(),
      };
    }
    return result;
  }
}
