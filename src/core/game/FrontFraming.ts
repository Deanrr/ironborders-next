import { Attack, Game, Player, PlayerType, UnitType } from "./Game";
import { TileRef } from "./GameMap";
import { deriveSupply } from "./NationalFraming";

export enum FrontMomentum {
  Stable = "stable",
  Advancing = "advancing",
  Stalled = "stalled",
  Overextended = "overextended",
  Collapsing = "collapsing",
  Reinforced = "reinforced",
  Breakthrough = "breakthrough",
}

export enum FrontEventType {
  Opened = "opened",
  MomentumChanged = "momentum_changed",
  Ended = "ended",
}

export interface FrontEvent {
  event: FrontEventType;
  frontID: string;
  name: string;
  attackerID: string;
  defenderID: string;
  momentum: FrontMomentum;
  previousMomentum?: FrontMomentum;
  tile?: TileRef;
}

export interface FrontSummary {
  frontID: string;
  name: string;
  attackerID: string;
  defenderID: string;
  positions: TileRef[];
  directionX: number;
  directionY: number;
  troopsCommitted: number;
  pressure: number;
  borderWidth: number;
  territoryGained: number;
  territoryLost: number;
  momentum: FrontMomentum;
}

interface FrontIdentity {
  frontID: string;
  attackerID: string;
  defenderID: string;
  ordinal: number;
  centroidX: number;
  centroidY: number;
  attackerTiles: number;
  defenderTiles: number;
  troopsCommitted: number;
  pressure: number;
  momentum: FrontMomentum;
}

interface FrontSegment {
  attack: Attack;
  position: TileRef;
  sourceTile: TileRef | null;
  attacker: Player;
  defender: Player;
}

const MAX_SEGMENT_DISTANCE = 70;
const IDENTITY_MATCH_DISTANCE = 140;

function distanceSquared(game: Game, first: TileRef, second: TileRef): number {
  const dx = game.x(first) - game.x(second);
  const dy = game.y(first) - game.y(second);
  return dx * dx + dy * dy;
}

function isNationalFront(attacker: Player, defender: Player): boolean {
  return attacker.type() !== PlayerType.Bot || defender.type() !== PlayerType.Bot;
}

function collectSegments(game: Game): FrontSegment[] {
  const segments: FrontSegment[] = [];
  for (const attacker of game.allPlayers()) {
    if (!attacker.isAlive()) continue;
    for (const attack of attacker.outgoingAttacks()) {
      if (!attack.isActive() || attack.retreated()) {
        continue;
      }
      const target = attack.target();
      if (!target.isPlayer()) continue;
      const defender = target;
      if (!defender.isAlive() || !isNationalFront(attacker, defender)) continue;
      const positions = attack.clusteredPositions();
      for (const position of positions) {
        segments.push({
          attack,
          position,
          sourceTile: attack.sourceTile(),
          attacker,
          defender,
        });
      }
    }
  }
  return segments;
}

function groupSegments(game: Game, segments: FrontSegment[]): FrontSegment[][] {
  const groups: FrontSegment[][] = [];
  const visited = new Set<number>();

  for (let index = 0; index < segments.length; index++) {
    if (visited.has(index)) continue;
    const seed = segments[index];
    const group: FrontSegment[] = [];
    const queue = [index];
    visited.add(index);

    while (queue.length > 0) {
      const currentIndex = queue.shift()!;
      const current = segments[currentIndex];
      group.push(current);

      for (
        let candidateIndex = 0;
        candidateIndex < segments.length;
        candidateIndex++
      ) {
        if (visited.has(candidateIndex)) continue;
        const candidate = segments[candidateIndex];
        if (
          candidate.attacker.id() !== seed.attacker.id() ||
          candidate.defender.id() !== seed.defender.id() ||
          distanceSquared(game, current.position, candidate.position) >
            MAX_SEGMENT_DISTANCE * MAX_SEGMENT_DISTANCE
        ) {
          continue;
        }
        visited.add(candidateIndex);
        queue.push(candidateIndex);
      }
    }

    groups.push(group);
  }
  return groups;
}

function directionForGroup(
  game: Game,
  group: FrontSegment[],
): [number, number] {
  let dx = 0;
  let dy = 0;
  for (const segment of group) {
    if (segment.sourceTile !== null) {
      dx += game.x(segment.position) - game.x(segment.sourceTile);
      dy += game.y(segment.position) - game.y(segment.sourceTile);
      continue;
    }

    let segmentDX = 0;
    let segmentDY = 0;

    // Land attacks generally do not carry a source tile. Their border
    // representatives are defender-owned tiles, so infer the advance vector
    // from adjacent attacker-owned territory when the live map exposes it.
    const neighbors4 = (
      game as Game & {
        neighbors4?: (tile: TileRef, out: TileRef[]) => number;
      }
    ).neighbors4;
    if (neighbors4 !== undefined) {
      const neighbors: TileRef[] = [0, 0, 0, 0];
      const count = neighbors4.call(game, segment.position, neighbors);
      for (let i = 0; i < count; i++) {
        const owner = game.owner(neighbors[i]);
        if (owner.isPlayer() && owner.id() === segment.attacker.id()) {
          segmentDX += game.x(segment.position) - game.x(neighbors[i]);
          segmentDY += game.y(segment.position) - game.y(neighbors[i]);
        }
      }
    }

    // Chokepoints and fragmented fronts may not have an adjacent attacker
    // tile in the representative's immediate neighborhood. Fall back to the
    // defender's spawn/capital direction so the front remains directional.
    if (segmentDX === 0 && segmentDY === 0) {
      const destination = segment.defender.spawnTile();
      if (destination !== undefined) {
        segmentDX += game.x(destination) - game.x(segment.position);
        segmentDY += game.y(destination) - game.y(segment.position);
      }
    }
    dx += segmentDX;
    dy += segmentDY;
  }
  const length = Math.sqrt(dx * dx + dy * dy);
  return length === 0 ? [0, 0] : [dx / length, dy / length];
}

function defensiveStructurePenalty(
  game: Game,
  group: FrontSegment[],
): number {
  const defender = group[0]?.defender;
  if (!defender) return 0;

  // Defensive structures are a bounded modifier on the readable front
  // summary. Combat still resolves through the underlying attacks; this only
  // prevents a fortified sector from looking as favorable as an open one.
  const units = defender.units(UnitType.DefensePost, UnitType.SAMLauncher);
  const positions = group.map((segment) => segment.position);
  const nearbyStructures = new Set<number>();
  for (const unit of units) {
    if (unit.isUnderConstruction()) continue;
    if (
      positions.some(
        (position) =>
          distanceSquared(game, position, unit.tile()) <= 12 * 12,
      )
    ) {
      nearbyStructures.add(unit.id());
    }
  }
  return Math.min(0.25, nearbyStructures.size * 0.05);
}

function frontSupply(game: Game, player: Player): number | null {
  const gameWithConfig = game as Game & {
    config?: () => { maxTroops: (p: Player) => number };
  };
  if (typeof gameWithConfig.config !== "function") return null;
  const incomingAttacks =
    typeof player.incomingAttacks === "function"
      ? player.incomingAttacks().filter((attack) => attack.isActive())
      : [];
  const outgoingAttacks =
    typeof player.outgoingAttacks === "function"
      ? player.outgoingAttacks().filter((attack) => attack.isActive())
      : [];
  const committedTroops = outgoingAttacks.reduce(
    (total, attack) => total + attack.troops(),
    0,
  );
  const troopCapacity = Math.max(
    1,
    gameWithConfig.config().maxTroops(player),
  );
  return deriveSupply({
    territoryFraction: 1,
    capitalThreatened: false,
    capitalEncircled: false,
    activeIncomingAttacks: incomingAttacks.length,
    activeOutgoingAttacks: outgoingAttacks.length,
    committedTroops,
    troopCapacity,
  });
}

function supplyPressureModifier(game: Game, group: FrontSegment[]): number {
  const first = group[0];
  if (!first) return 1;
  const attackerSupply = frontSupply(game, first.attacker);
  const defenderSupply = frontSupply(game, first.defender);
  if (attackerSupply === null || defenderSupply === null) return 1;

  // Keep supply readable rather than letting it replace combat: a fully
  // strained attacker is capped at a 10% pressure reduction, while a healthy
  // attacker facing a strained defender receives at most a 10% lift.
  const ratio = Math.max(
    0.5,
    Math.min(1.5, attackerSupply / Math.max(1, defenderSupply)),
  );
  return Math.max(0.9, Math.min(1.1, 0.8 + ratio * 0.2));
}

function momentumFor(
  identity: FrontIdentity | undefined,
  attackerTiles: number,
  defenderTiles: number,
  troopsCommitted: number,
  pressure: number,
  borderWidth: number,
): FrontMomentum {
  if (!identity) return FrontMomentum.Stable;
  const attackerDelta = attackerTiles - identity.attackerTiles;
  const defenderDelta = defenderTiles - identity.defenderTiles;
  if (defenderDelta < 0 && pressure >= 0.75) {
    return FrontMomentum.Breakthrough;
  }
  if (attackerDelta > 0 || defenderDelta < 0) {
    return FrontMomentum.Advancing;
  }
  if (attackerDelta < 0 && pressure < 0.45) {
    return FrontMomentum.Collapsing;
  }
  if (borderWidth > 50 && pressure > 0.7) {
    return FrontMomentum.Overextended;
  }
  if (
    troopsCommitted > identity.troopsCommitted &&
    pressure > identity.pressure
  ) {
    return FrontMomentum.Reinforced;
  }
  if (Math.abs(attackerDelta) <= 1 && Math.abs(defenderDelta) <= 1) {
    return FrontMomentum.Stalled;
  }
  return FrontMomentum.Stable;
}

/**
 * Tracks connected active attacks as readable national fronts. This is a
 * summary layer: individual Attack objects continue to resolve combat.
 */
export class FrontFramingTracker {
  private identities = new Map<string, FrontIdentity>();
  private nextFrontOrdinal = 1;
  private activeFrontIDs = new Set<string>();
  private pendingEvents: FrontEvent[] = [];

  constructor(private game: Game) {}

  drainEvents(): FrontEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  evaluate(): FrontSummary[] {
    const groups = groupSegments(this.game, collectSegments(this.game));
    const claimedIdentityIDs = new Set<string>();
    const summaries: FrontSummary[] = [];

    for (const group of groups) {
      const first = group[0];
      const positions = Array.from(
        new Set(group.map((segment) => segment.position)),
      );
      const centroidX =
        positions.reduce((sum, tile) => sum + this.game.x(tile), 0) /
        positions.length;
      const centroidY =
        positions.reduce((sum, tile) => sum + this.game.y(tile), 0) /
        positions.length;
      const prior = Array.from(this.identities.values())
        .filter(
          (identity) =>
            identity.attackerID === first.attacker.id() &&
            identity.defenderID === first.defender.id() &&
            !claimedIdentityIDs.has(identity.frontID),
        )
        .sort((a, b) => {
          const distanceA =
            (a.centroidX - centroidX) ** 2 + (a.centroidY - centroidY) ** 2;
          const distanceB =
            (b.centroidX - centroidX) ** 2 + (b.centroidY - centroidY) ** 2;
          return distanceA - distanceB;
        })[0];
      const priorDistance = prior
        ? Math.sqrt(
            (prior.centroidX - centroidX) ** 2 +
              (prior.centroidY - centroidY) ** 2,
          )
        : Infinity;
      const identity =
        prior && priorDistance <= IDENTITY_MATCH_DISTANCE
          ? prior
          : {
              frontID: `front-${this.nextFrontOrdinal}`,
              attackerID: first.attacker.id(),
              defenderID: first.defender.id(),
              ordinal: this.nextFrontOrdinal++,
              centroidX,
              centroidY,
              attackerTiles: first.attacker.numTilesOwned(),
              defenderTiles: first.defender.numTilesOwned(),
              troopsCommitted: 0,
              pressure: 0,
              momentum: FrontMomentum.Stable,
            };
      claimedIdentityIDs.add(identity.frontID);

      const attackIDs = new Set<string>();
      let troopsCommitted = 0;
      let borderWidth = 0;
      for (const segment of group) {
        if (attackIDs.has(segment.attack.id())) continue;
        attackIDs.add(segment.attack.id());
        troopsCommitted += segment.attack.troops();
        borderWidth += segment.attack.borderSize();
      }
      const rawPressure =
        troopsCommitted /
        Math.max(1, troopsCommitted + first.defender.troops());
      const pressure = Math.max(
        0,
        Math.min(
          1,
          rawPressure * supplyPressureModifier(this.game, group) -
            defensiveStructurePenalty(this.game, group),
        ),
      );
      const [directionX, directionY] = directionForGroup(this.game, group);
      const momentum = momentumFor(
        prior,
        first.attacker.numTilesOwned(),
        first.defender.numTilesOwned(),
        troopsCommitted,
        pressure,
        borderWidth,
      );
      const frontName = `${first.attacker.displayName()}–${first.defender.displayName()} Front ${identity.ordinal}`;
      if (!prior) {
        this.pendingEvents.push({
          event: FrontEventType.Opened,
          frontID: identity.frontID,
          name: frontName,
          attackerID: first.attacker.id(),
          defenderID: first.defender.id(),
          momentum,
          tile: positions[0],
        });
      } else if (prior.momentum !== momentum) {
        this.pendingEvents.push({
          event: FrontEventType.MomentumChanged,
          frontID: identity.frontID,
          name: frontName,
          attackerID: first.attacker.id(),
          defenderID: first.defender.id(),
          momentum,
          previousMomentum: prior.momentum,
          tile: positions[0],
        });
      }
      const nextIdentity: FrontIdentity = {
        ...identity,
        centroidX,
        centroidY,
        attackerTiles: first.attacker.numTilesOwned(),
        defenderTiles: first.defender.numTilesOwned(),
        troopsCommitted,
        pressure,
        momentum,
      };
      this.identities.set(identity.frontID, nextIdentity);

      summaries.push({
        frontID: identity.frontID,
        name: frontName,
        attackerID: first.attacker.id(),
        defenderID: first.defender.id(),
        positions,
        directionX,
        directionY,
        troopsCommitted,
        pressure,
        borderWidth,
        territoryGained: prior
          ? Math.max(0, first.attacker.numTilesOwned() - prior.attackerTiles)
          : 0,
        territoryLost: prior
          ? Math.max(0, prior.defenderTiles - first.defender.numTilesOwned())
          : 0,
        momentum,
      });
    }
    for (const frontID of this.activeFrontIDs) {
      if (claimedIdentityIDs.has(frontID)) continue;
      const identity = this.identities.get(frontID);
      if (!identity) continue;
      this.pendingEvents.push({
        event: FrontEventType.Ended,
        frontID,
        name: `Front ${identity.ordinal}`,
        attackerID: identity.attackerID,
        defenderID: identity.defenderID,
        momentum: identity.momentum,
      });
    }
    this.activeFrontIDs = claimedIdentityIDs;
    return summaries;
  }
}
