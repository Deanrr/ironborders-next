import {
  Game,
  GameMode,
  Player,
  PlayerID,
  PlayerType,
  UnitType,
} from "./Game";
import { TileRef } from "./GameMap";
import {
  deriveGeographicLocations,
  StrategicLocationType,
} from "./NationalFraming";

export type FactionObjective =
  | "consolidate_control"
  | "breakthrough"
  | "hold_frontier"
  | "last_stand";

export enum FactionEventType {
  VictoryReady = "victory_ready",
  ObjectiveChanged = "objective_changed",
  ObjectiveSecured = "objective_secured",
  CoalitionFormed = "coalition_formed",
  CoalitionDisbanded = "coalition_disbanded",
}

export interface FactionSummary {
  factionID: string;
  label: string;
  members: PlayerID[];
  territoryTiles: number;
  territoryFraction: number;
  troops: number;
  activeFronts: number;
  victoryProgress: number;
  victoryReady: boolean;
  objective: FactionObjective;
  objectiveTile?: TileRef;
  objectiveLocationType?: StrategicLocationType;
  objectiveSecured: boolean;
}

function alliancePair(first: Player, second: Player): boolean {
  const firstAllied =
    typeof first.isAlliedWith === "function" && first.isAlliedWith(second);
  const secondAllied =
    typeof second.isAlliedWith === "function" && second.isAlliedWith(first);
  return firstAllied || secondAllied;
}

function factionID(players: Player[], teamMode: boolean): string {
  if (teamMode) {
    const team = players[0]?.team();
    if (team !== null && team !== undefined) return `team:${team}`;
  }
  const memberIDs = players.map((player) => player.id()).sort();
  return memberIDs.length > 1
    ? `coalition:${memberIDs.join("+")}`
    : `nation:${memberIDs[0]}`;
}

function factionLabel(players: Player[], teamMode: boolean): string {
  if (teamMode) return players[0]?.team() ?? players[0].displayName();
  return players.length > 1
    ? `${players[0].displayName()} Coalition`
    : players[0].displayName();
}

function objectiveFor(
  territoryFraction: number,
  activeFronts: number,
  factionCount: number,
): FactionObjective {
  if (territoryFraction < 0.15) return "last_stand";
  if (activeFronts === 0) return "consolidate_control";
  if (factionCount <= 2 && territoryFraction >= 0.45) return "breakthrough";
  return "hold_frontier";
}

function objectiveTargetFor(
  game: Game,
  players: Player[],
  objective: FactionObjective,
): { objectiveTile?: TileRef; objectiveLocationType?: StrategicLocationType } {
  const spawnTile = (player: Player): TileRef | undefined =>
    typeof player.spawnTile === "function" ? player.spawnTile() : undefined;
  const frontierTile = (player: Player): TileRef | undefined => {
    if (typeof player.borderTiles !== "function") return undefined;
    return Array.from(player.borderTiles())[0];
  };
  const unitLocation = (
    player: Player,
    type: UnitType,
    locationType: StrategicLocationType,
  ) => {
    if (typeof player.units !== "function") return undefined;
    const unit = player.units(type)[0];
    if (unit === undefined) return undefined;
    return { objectiveTile: unit.tile(), objectiveLocationType: locationType };
  };
  const consolidatedLocation = () => {
    const priorities: Array<[UnitType, StrategicLocationType]> = [
      [UnitType.Factory, StrategicLocationType.IndustrialRegion],
      [UnitType.City, StrategicLocationType.MajorCity],
      [UnitType.Port, StrategicLocationType.Port],
    ];
    for (const player of players) {
      for (const [type, locationType] of priorities) {
        const target = unitLocation(player, type, locationType);
        if (target !== undefined) return target;
      }
    }
    return undefined;
  };
  const frontierLocation = () => {
    if (
      typeof game.neighbors4 !== "function" ||
      typeof game.isLand !== "function" ||
      typeof game.isShore !== "function" ||
      typeof game.owner !== "function"
    ) {
      return undefined;
    }
    const locations = players.flatMap((player) =>
      deriveGeographicLocations(game, player),
    );
    return locations.find(
      (location) =>
        location.type === StrategicLocationType.Chokepoint ||
        location.type === StrategicLocationType.Crossing,
    );
  };
  if (objective === "breakthrough") {
    const target = game
      .allPlayers()
      .find(
        (player) =>
          player.isAlive() &&
          player.type() !== PlayerType.Bot &&
          !players.includes(player),
      );
    const tile = target === undefined ? undefined : spawnTile(target);
    return tile === undefined
      ? {}
      : {
          objectiveTile: tile,
          objectiveLocationType: StrategicLocationType.Capital,
        };
  }
  if (objective === "last_stand") {
    const tile = spawnTile(players[0]);
    return tile === undefined
      ? {}
      : {
          objectiveTile: tile,
          objectiveLocationType: StrategicLocationType.Capital,
        };
  }
  if (objective === "consolidate_control") {
    return consolidatedLocation() ?? {
      objectiveTile: spawnTile(players[0]),
    };
  }
  if (objective === "hold_frontier") {
    const location = frontierLocation();
    if (location !== undefined) {
      return {
        objectiveTile: location.tile,
        objectiveLocationType: location.type,
      };
    }
  }
  const tile =
    objective === "hold_frontier"
      ? players
          .map(frontierTile)
          .find((candidate): candidate is TileRef => candidate !== undefined)
      : spawnTile(players[0]);
  return tile === undefined ? {} : { objectiveTile: tile };
}

/**
 * National framing for victory objectives. This is deliberately read-only:
 * the existing Game winner/Doomsday rules remain the authority for victory.
 */
export function deriveFactionSummaries(game: Game): FactionSummary[] {
  const teamMode = game.config().gameConfig().gameMode === GameMode.Team;
  const eligible = game
    .allPlayers()
    .filter((player) => player.isAlive() && player.type() !== PlayerType.Bot);
  const factionGroups: Player[][] = [];
  const visited = new Set<PlayerID>();

  for (const player of eligible) {
    if (visited.has(player.id())) continue;
    const members: Player[] = [player];
    visited.add(player.id());
    if (!teamMode) {
      for (let index = 0; index < members.length; index++) {
        const member = members[index];
        for (const candidate of eligible) {
          if (
            visited.has(candidate.id()) ||
            !alliancePair(member, candidate)
          ) {
            continue;
          }
          visited.add(candidate.id());
          members.push(candidate);
        }
      }
    } else {
      for (const candidate of eligible) {
        if (
          !visited.has(candidate.id()) &&
          candidate.team() !== null &&
          candidate.team() === player.team()
        ) {
          visited.add(candidate.id());
          members.push(candidate);
        }
      }
    }
    factionGroups.push(members);
  }

  const groups = new Map<
    string,
    { label: string; players: Player[]; activeFronts: number }
  >();
  for (const players of factionGroups) {
    const id = factionID(players, teamMode);
    groups.set(id, {
      label: factionLabel(players, teamMode),
      players,
      activeFronts: players.reduce(
        (total, player) =>
          total +
          player
            .outgoingAttacks()
            .filter((attack) => attack.isActive() && attack.target().isPlayer())
            .length,
        0,
      ),
    });
  }

  const denominator = Math.max(1, game.numLandTiles());
  const factionCount = groups.size;
  const victoryThreshold = Math.max(
    0.01,
    Math.min(1, game.config().percentageTilesOwnedToWin() / 100),
  );
  return Array.from(groups, ([id, group]) => {
    const territoryTiles = group.players.reduce(
      (total, player) => total + player.numTilesOwned(),
      0,
    );
    const territoryFraction = Math.max(
      0,
      Math.min(1, territoryTiles / denominator),
    );
    const victoryProgress =
      Math.round(Math.max(0, Math.min(1, territoryFraction / victoryThreshold)) * 100) /
      100;
    const objective = objectiveFor(
      territoryFraction,
      group.activeFronts,
      factionCount,
    );
    const objectiveTarget = objectiveTargetFor(game, group.players, objective);
    const objectiveOwner =
      objectiveTarget.objectiveTile === undefined
        ? undefined
        : game.owner(objectiveTarget.objectiveTile);
    const objectiveSecured =
      objectiveOwner?.isPlayer() === true &&
      group.players.some((member) => member.id() === objectiveOwner.id());
    return {
      factionID: id,
      label: group.label,
      members: group.players.map((player) => player.id()),
      territoryTiles,
      territoryFraction,
      troops: group.players.reduce(
        (total, player) => total + player.troops(),
        0,
      ),
      activeFronts: group.activeFronts,
      victoryProgress,
      victoryReady: territoryFraction >= victoryThreshold,
      objective,
      ...objectiveTarget,
      objectiveSecured,
    };
  }).sort((a, b) => b.territoryTiles - a.territoryTiles);
}

export type FactionStateSnapshot = FactionSummary;

export interface FactionEventSnapshot {
  event: FactionEventType;
  factionID: string;
  label: string;
  members: PlayerID[];
  objective: FactionObjective;
  victoryProgress: number;
  objectiveTile?: TileRef;
  objectiveLocationType?: StrategicLocationType;
  objectiveSecured: boolean;
}

/** Emits campaign-level objective milestones without resolving the match. */
export class FactionFramingTracker {
  private previous = new Map<string, FactionSummary>();

  constructor(private readonly game: Game) {}

  evaluate(): {
    states: FactionSummary[];
    events: FactionEventSnapshot[];
  } {
    const states = deriveFactionSummaries(this.game);
    const events: FactionEventSnapshot[] = [];
    const eventSnapshot = (
      state: FactionSummary,
      event: FactionEventType,
    ): FactionEventSnapshot => ({
      event,
      factionID: state.factionID,
      label: state.label,
      members: state.members,
      objective: state.objective,
      victoryProgress: state.victoryProgress,
      objectiveTile: state.objectiveTile,
      objectiveLocationType: state.objectiveLocationType,
      objectiveSecured: state.objectiveSecured,
    });
    const currentFactionIDs = new Set(states.map((state) => state.factionID));
    for (const prior of this.previous.values()) {
      if (
        prior.factionID.startsWith("coalition:") &&
        !currentFactionIDs.has(prior.factionID)
      ) {
        events.push(eventSnapshot(prior, FactionEventType.CoalitionDisbanded));
      }
    }
    for (const state of states) {
      const prior = this.previous.get(state.factionID);
      if (prior === undefined && state.factionID.startsWith("coalition:")) {
        events.push(eventSnapshot(state, FactionEventType.CoalitionFormed));
      }
      if (prior !== undefined) {
        if (!prior.victoryReady && state.victoryReady) {
          events.push({
            event: FactionEventType.VictoryReady,
            factionID: state.factionID,
            label: state.label,
            members: state.members,
            objective: state.objective,
            victoryProgress: state.victoryProgress,
            objectiveTile: state.objectiveTile,
            objectiveLocationType: state.objectiveLocationType,
            objectiveSecured: state.objectiveSecured,
          });
        }
        if (prior.objective !== state.objective) {
          events.push({
            event: FactionEventType.ObjectiveChanged,
            factionID: state.factionID,
            label: state.label,
            members: state.members,
            objective: state.objective,
            victoryProgress: state.victoryProgress,
            objectiveTile: state.objectiveTile,
            objectiveLocationType: state.objectiveLocationType,
            objectiveSecured: state.objectiveSecured,
          });
        }
        if (!prior.objectiveSecured && state.objectiveSecured) {
          events.push({
            event: FactionEventType.ObjectiveSecured,
            factionID: state.factionID,
            label: state.label,
            members: state.members,
            objective: state.objective,
            victoryProgress: state.victoryProgress,
            objectiveTile: state.objectiveTile,
            objectiveLocationType: state.objectiveLocationType,
            objectiveSecured: state.objectiveSecured,
          });
        }
      }
      this.previous.set(state.factionID, state);
    }
    return { states, events };
  }
}
