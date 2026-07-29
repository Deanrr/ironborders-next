import { simpleHash } from "../Util";
import {
  Game,
  Nation,
  Player,
  PlayerID,
  PlayerType,
  Relation,
  TerraNullius,
  Tick,
  UnitType,
} from "./Game";
import { GameMap, TileRef } from "./GameMap";
import { NationDoctrine, resolveNationDoctrine } from "./NationDoctrine";

/** Political control of a nation, derived from the live territorial state. */
export enum AuthorityState {
  Sovereign = "sovereign",
  Contested = "contested",
  PartiallyOccupied = "partially_occupied",
  CapitalThreatened = "capital_threatened",
  CapitalOccupied = "capital_occupied",
  GovernmentDisplaced = "government_displaced",
  FullyOccupied = "fully_occupied",
  Liberated = "liberated",
}

export enum StrategicLocationType {
  Capital = "capital",
  MajorCity = "major_city",
  Port = "port",
  IndustrialRegion = "industrial_region",
  LogisticsHub = "logistics_hub",
  Chokepoint = "chokepoint",
  Crossing = "crossing",
  StrategicIsland = "strategic_island",
}

export enum NationalEventType {
  BorderBreached = "border_breached",
  DefensiveLineBroken = "defensive_line_broken",
  MajorRegionSecured = "major_region_secured",
  CapitalThreatened = "capital_threatened",
  CapitalSecured = "capital_secured",
  CapitalEncircled = "capital_encircled",
  CapitalCaptured = "capital_captured",
  GovernmentDisplaced = "government_displaced",
  NationOccupied = "nation_occupied",
  ResistanceSurging = "resistance_surging",
  ResistanceContained = "resistance_contained",
  NationPartiallyOccupied = "nation_partially_occupied",
  NationLiberated = "nation_liberated",
  LiberationAttempted = "liberation_attempted",
  NationEliminated = "nation_eliminated",
  SupplyCrisis = "supply_crisis",
  SupplyRestored = "supply_restored",
  WarExhaustionHigh = "war_exhaustion_high",
  WarExhaustionRecovered = "war_exhaustion_recovered",
  ProductionDisrupted = "production_disrupted",
  ProductionRecovered = "production_recovered",
  OverextensionHigh = "overextension_high",
  OverextensionRecovered = "overextension_recovered",
  StrategicLocationThreatened = "strategic_location_threatened",
  StrategicLocationCaptured = "strategic_location_captured",
  StrategicLocationSecured = "strategic_location_secured",
}

export interface StrategicLocation {
  id: string;
  type: StrategicLocationType;
  ownerID: PlayerID | null;
  tile: TileRef;
  threatened?: boolean;
}

/**
 * Border-derived locations are intentionally ephemeral. They describe the
 * current frontier and must not remain in the national history after the
 * border moves or the front closes.
 */
function isDynamicGeographicLocation(location: StrategicLocation): boolean {
  return (
    location.type === StrategicLocationType.Chokepoint ||
    location.type === StrategicLocationType.Crossing ||
    location.type === StrategicLocationType.StrategicIsland
  );
}

export interface NationalSummary {
  nationID: PlayerID;
  displayName: string;
  doctrine: NationDoctrine;
  capital: StrategicLocation;
  authorityState: AuthorityState;
  territoryTiles: number;
  territoryFraction: number;
  troops: number;
  gold: bigint;
  cities: number;
  ports: number;
  factories: number;
  locations: StrategicLocation[];
  allies: PlayerID[];
  enemies: PlayerID[];
  capitalThreatened: boolean;
  capitalEncircled: boolean;
  occupationResistance: number;
  stability: number;
  supply: number;
  overextension: number;
  warExhaustion: number;
  productionModifier: number;
}

export interface SupplyInput {
  territoryFraction: number;
  capitalThreatened: boolean;
  capitalEncircled: boolean;
  activeIncomingAttacks: number;
  activeOutgoingAttacks: number;
  committedTroops: number;
  troopCapacity: number;
  overextension?: number;
  logisticsHubs?: number;
}

/** Derive a readable supply signal from live fronts and national pressure. */
export function deriveSupply(input: SupplyInput): number {
  const occupied = 1 - Math.max(0, Math.min(1, input.territoryFraction));
  const capacity = Math.max(1, input.troopCapacity);
  const commitment = Math.max(0, Math.min(1, input.committedTroops / capacity));
  let pressure = occupied * 35;
  pressure += Math.min(30, input.activeIncomingAttacks * 8);
  pressure += Math.min(20, input.activeOutgoingAttacks * 4);
  pressure += commitment * 25;
  pressure += Math.min(20, Math.max(0, input.overextension ?? 0) * 0.2);
  pressure -= Math.min(18, Math.max(0, input.logisticsHubs ?? 0) * 5);
  if (input.capitalThreatened) pressure += 12;
  if (input.capitalEncircled) pressure += 18;
  return Math.round(Math.max(0, Math.min(100, 100 - pressure)));
}

export interface OverextensionInput {
  territoryTiles: number;
  baselineTerritoryTiles: number;
  activeOutgoingAttacks: number;
  committedTroops: number;
  troopCapacity: number;
}

/** Derive expansion burden from territory growth and active commitments. */
export function deriveOverextension(input: OverextensionInput): number {
  const baseline = Math.max(1, input.baselineTerritoryTiles);
  const expansion = Math.max(0, input.territoryTiles / baseline - 1);
  const commitment = Math.max(
    0,
    Math.min(1, input.committedTroops / Math.max(1, input.troopCapacity)),
  );
  const activeFronts = Math.max(0, input.activeOutgoingAttacks);
  return Math.round(
    Math.max(
      0,
      Math.min(100, expansion * 50 + activeFronts * 8 + commitment * 25),
    ),
  );
}

export function advanceWarExhaustion(
  previous: number,
  activeWar: boolean,
  supply: number,
  territoryLoss: number,
): number {
  const increment = activeWar
    ? 1 + (supply < 40 ? 1 : 0) + (territoryLoss > 0.02 ? 1 : 0)
    : -1;
  return Math.round(Math.max(0, Math.min(100, previous + increment)));
}

export interface NationalProductionInput {
  territoryFraction: number;
  activeIncomingAttacks: number;
  activeOutgoingAttacks: number;
  industrialRegions?: number;
  majorCities?: number;
  warExhaustion?: number;
  capitalThreatened?: boolean;
  capitalEncircled?: boolean;
  capitalOccupied?: boolean;
  occupationResistance?: number;
  overextension?: number;
}

/**
 * Captured regions and active fronts reduce national output. This modifier is
 * intentionally bounded: it creates an occupation burden without replacing
 * the existing economy or troop-capacity rules.
 */
export function deriveNationalProductionModifier({
  territoryFraction,
  activeIncomingAttacks,
  activeOutgoingAttacks,
  industrialRegions = 0,
  majorCities = 0,
  warExhaustion = 0,
  capitalThreatened = false,
  capitalEncircled = false,
  capitalOccupied = false,
  occupationResistance = 0,
  overextension = 0,
}: NationalProductionInput): number {
  const occupiedFraction =
    1 - Math.max(0, Math.min(1, territoryFraction));
  const frontPressure = Math.min(
    0.2,
    (Math.max(0, activeIncomingAttacks) +
      Math.max(0, activeOutgoingAttacks)) *
    0.025,
  );
  const capitalPressure =
    (capitalThreatened ? 0.05 : 0) +
    (capitalEncircled ? 0.05 : 0) +
    (capitalOccupied ? 0.15 : 0);
  const resistanceBurden =
    Math.max(0, Math.min(100, occupationResistance)) * 0.0005;
  const overextensionBurden =
    Math.max(0, Math.min(100, overextension)) * 0.001;
  // Factories and cities are live strategic regions: holding them offsets
  // wartime burdens without introducing a second economy simulation.
  const regionalOutput = Math.min(
    0.15,
    Math.max(0, industrialRegions) * 0.02 + Math.max(0, majorCities) * 0.005,
  );
  const totalBurden =
    occupiedFraction * 0.55 +
    frontPressure +
    capitalPressure +
    resistanceBurden +
    overextensionBurden +
    Math.max(0, Math.min(100, warExhaustion)) * 0.0015;
  const modifier = Math.max(
    0.4,
    Math.min(1, 1 - totalBurden + regionalOutput),
  );
  return Math.round(modifier * 100) / 100;
}

export interface OccupationResistanceInput {
  territoryFraction: number;
  capitalOwned: boolean;
  capitalThreatened: boolean;
  capitalEncircled: boolean;
  hasActiveIncomingAttack: boolean;
}

/**
 * Derive resistance as a consequence of occupation pressure. This is a
 * national modifier, not a replacement combat stat: territorial resolution
 * remains entirely in the existing attack/ownership simulation.
 */
export function deriveOccupationResistance({
  territoryFraction,
  capitalOwned,
  capitalThreatened,
  capitalEncircled,
  hasActiveIncomingAttack,
}: OccupationResistanceInput): number {
  const occupiedFraction = 1 - Math.max(0, Math.min(1, territoryFraction));
  let resistance = occupiedFraction * 60;
  if (!capitalOwned) resistance += 20;
  if (capitalThreatened) resistance += 10;
  if (capitalEncircled) resistance += 10;
  if (hasActiveIncomingAttack) resistance += 5;
  return Math.round(Math.max(0, Math.min(100, resistance)));
}

/**
 * Find a small, stable set of geography-driven objectives from live ownership
 * topology. These markers are descriptive only; attacks still resolve through
 * the existing territorial simulation.
 */
export function deriveGeographicLocations(
  game: Game,
  player: Player,
): StrategicLocation[] {
  const candidates = Array.from(player.borderTiles());
  const topology = candidates.map((tile) => {
    const neighbors: TileRef[] = [0, 0, 0, 0];
    const count = game.neighbors4(tile, neighbors);
    let friendly = 0;
    let hostile = 0;
    let land = 0;
    for (let i = 0; i < count; i++) {
      const neighbor = neighbors[i];
      if (!game.isLand(neighbor)) continue;
      land++;
      const owner = game.owner(neighbor);
      if (!owner.isPlayer()) continue;
      if (owner.id() === player.id()) friendly++;
      else if (!player.isFriendly(owner)) hostile++;
    }
    return { tile, friendly, hostile, land };
  });
  const byPriority = (left: typeof topology[number], right: typeof topology[number]) =>
    right.hostile - left.hostile || left.friendly - right.friendly || left.tile - right.tile;
  const locations: StrategicLocation[] = [];
  for (const candidate of topology
    .filter((entry) => !game.isShore(entry.tile) && entry.friendly <= 1 && entry.hostile >= 1)
    .sort(byPriority)
    .slice(0, 3)) {
    locations.push({
      id: `${player.id()}:chokepoint:${candidate.tile}`,
      type: StrategicLocationType.Chokepoint,
      ownerID: player.id(),
      tile: candidate.tile,
    });
  }
  for (const candidate of topology
    .filter((entry) => entry.friendly >= 1 && entry.hostile >= 2)
    .sort(byPriority)
    .slice(0, 3)) {
    locations.push({
      id: `${player.id()}:crossing:${candidate.tile}`,
      type: StrategicLocationType.Crossing,
      ownerID: player.id(),
      tile: candidate.tile,
    });
  }
  for (const candidate of topology
    .filter(
      (entry) =>
        game.isShore(entry.tile) && entry.land <= 1 && entry.hostile === 0,
    )
    .sort((left, right) => left.tile - right.tile)
    .slice(0, 3)) {
    locations.push({
      id: `${player.id()}:island:${candidate.tile}`,
      type: StrategicLocationType.StrategicIsland,
      ownerID: player.id(),
      tile: candidate.tile,
    });
  }
  return locations;
}

/**
 * Move resistance toward its live territorial target without making it an
 * instantaneous combat stat. Recovery is faster once a sovereign capital is
 * secure and no active fronts remain, but recently occupied territory keeps
 * a measurable instability burden for several national updates.
 */
export function advanceOccupationResistance(
  previous: number | null,
  target: number,
  recovery: boolean,
): number {
  const boundedTarget = Math.round(Math.max(0, Math.min(100, target)));
  if (previous === null) return boundedTarget;
  const boundedPrevious = Math.max(0, Math.min(100, previous));
  const delta = boundedTarget - boundedPrevious;
  const step = delta >= 0 ? 8 : recovery ? 2 : 1;
  return Math.round(
    Math.max(
      0,
      Math.min(100, boundedPrevious + Math.max(-step, Math.min(step, delta))),
    ),
  );
}

export interface NationalMilestoneInput {
  summary: NationalSummary;
  hasActiveIncomingAttack: boolean;
  isAlive: boolean;
  territoryGained?: number;
  regionThreshold?: number;
}

export function deriveStrategicLocations(
  player: Player,
  capitalOwner: Player | TerraNullius,
  capitalTile: TileRef,
  game?: Game,
): StrategicLocation[] {
  const locations = [
    {
      id: `${player.id()}:capital`,
      type: StrategicLocationType.Capital,
      ownerID: capitalOwner.isPlayer() ? capitalOwner.id() : null,
      tile: capitalTile,
    },
    ...player.units(UnitType.City).map((unit) => ({
      id: `${player.id()}:city:${unit.id()}`,
      type: StrategicLocationType.MajorCity,
      ownerID: player.id(),
      tile: unit.tile(),
    })),
    ...player.units(UnitType.Port).map((unit) => ({
      id: `${player.id()}:port:${unit.id()}`,
      type: StrategicLocationType.Port,
      ownerID: player.id(),
      tile: unit.tile(),
    })),
    ...player.units(UnitType.Factory).map((unit) => ({
      id: `${player.id()}:factory:${unit.id()}`,
      type: StrategicLocationType.IndustrialRegion,
      ownerID: player.id(),
      tile: unit.tile(),
    })),
    ...player.units(UnitType.LogisticsHub).map((unit) => ({
      id: `${player.id()}:logistics_hub:${unit.id()}`,
      type: StrategicLocationType.LogisticsHub,
      ownerID: player.id(),
      tile: unit.tile(),
    })),
  ];
  return game === undefined
    ? locations
    : locations.concat(deriveGeographicLocations(game, player));
}

/** Derive capital danger from active attacks and adjacent hostile territory. */
export function deriveCapitalThreatened(
  game: Game,
  player: Player,
  capitalTile: TileRef,
): boolean {
  if (
    player.incomingAttacks().some(
      (attack) =>
        attack.isActive() && attack.clusteredPositions().includes(capitalTile),
    )
  ) {
    return true;
  }
  const neighbors: TileRef[] = [0, 0, 0, 0];
  const count = game.neighbors4(capitalTile, neighbors);
  for (let i = 0; i < count; i++) {
    const owner = game.owner(neighbors[i]);
    if (
      owner.isPlayer() &&
      owner.id() !== player.id() &&
      !player.isFriendly(owner)
    ) {
      return true;
    }
  }
  return false;
}

function isStrategicLocationThreatened(
  game: Game,
  player: Player,
  tile: TileRef,
): boolean {
  if (
    player
      .incomingAttacks()
      .some(
        (attack) =>
          attack.isActive() && attack.clusteredPositions().includes(tile),
      )
  ) {
    return true;
  }
  const neighbors: TileRef[] = [0, 0, 0, 0];
  const count = game.neighbors4(tile, neighbors);
  for (let i = 0; i < count; i++) {
    const owner = game.owner(neighbors[i]);
    if (owner.isPlayer() && owner !== player && !player.isFriendly(owner)) {
      return true;
    }
  }
  return false;
}

function refreshStrategicLocations(
  game: Game,
  player: Player,
  locations: StrategicLocation[],
): StrategicLocation[] {
  return locations.map((location) => {
    const owner = game.owner(location.tile);
    return {
      ...location,
      ownerID: owner.isPlayer() ? owner.id() : null,
      threatened:
        owner.isPlayer() && owner.id() !== player.id()
          ? true
          : isStrategicLocationThreatened(game, player, location.tile),
    };
  });
}

/**
 * Return conquest milestones that are true in the current simulation state.
 * Thresholds are deliberately derived from territory/capital control rather
 * than introducing a second combat or occupation system.
 */
export function deriveNationalMilestones({
  summary,
  hasActiveIncomingAttack,
  isAlive,
  territoryGained = 0,
  regionThreshold = 1,
}: NationalMilestoneInput): NationalEventType[] {
  const milestones: NationalEventType[] = [];
  const capitalOwned = summary.capital.ownerID === summary.nationID;
  if (hasActiveIncomingAttack) {
    milestones.push(NationalEventType.BorderBreached);
  }
  if (hasActiveIncomingAttack && summary.territoryFraction <= 0.9) {
    milestones.push(NationalEventType.DefensiveLineBroken);
  }
  if (territoryGained >= Math.max(1, regionThreshold)) {
    milestones.push(NationalEventType.MajorRegionSecured);
  }
  if (!capitalOwned && summary.territoryFraction <= 0.25) {
    milestones.push(NationalEventType.GovernmentDisplaced);
  }
  if (isAlive && !capitalOwned && summary.territoryFraction <= 0.25) {
    milestones.push(NationalEventType.NationOccupied);
  }
  return milestones;
}

export interface AuthorityStateInput {
  isAlive: boolean;
  territoryFraction: number;
  capitalOwned: boolean;
  capitalThreatened: boolean;
  capitalEncircled: boolean;
  contested?: boolean;
  wasLiberated?: boolean;
}

/**
 * Derive political state without changing simulation rules. The ordering is
 * deliberate: elimination/occupation takes precedence over threat styling,
 * while liberation is retained as a readable state until the next stable
 * sovereign tick.
 */
export function deriveAuthorityState({
  isAlive,
  territoryFraction,
  capitalOwned,
  capitalThreatened,
  capitalEncircled,
  contested = false,
  wasLiberated = false,
}: AuthorityStateInput): AuthorityState {
  if (wasLiberated && isAlive && capitalOwned) {
    return AuthorityState.Liberated;
  }
  if (!isAlive || territoryFraction <= 0) {
    return AuthorityState.FullyOccupied;
  }
  if (!capitalOwned && territoryFraction <= 0.25) {
    return AuthorityState.GovernmentDisplaced;
  }
  if (!capitalOwned) {
    return AuthorityState.CapitalOccupied;
  }
  if (capitalEncircled) {
    return AuthorityState.CapitalThreatened;
  }
  if (capitalThreatened) {
    return AuthorityState.CapitalThreatened;
  }
  if (territoryFraction < 1) {
    return AuthorityState.PartiallyOccupied;
  }
  if (contested) {
    return AuthorityState.Contested;
  }
  return AuthorityState.Sovereign;
}

/**
 * Resolve a nation's capital from map metadata. Manifest spawn coordinates
 * are preferred; generated nations use their actual spawn tile, then a stable
 * first-land fallback. This keeps capitals deterministic on maps with sparse
 * or missing nation metadata.
 */
export function resolveCapitalTile(
  map: GameMap,
  nation: Nation,
  spawnedTile?: TileRef,
  fallbackSeed = nation.playerInfo.id,
): TileRef {
  const candidates: TileRef[] = [];
  if (nation.spawnCell !== undefined) {
    const { x, y } = nation.spawnCell;
    if (map.isValidCoord(x, y)) candidates.push(map.ref(x, y));
  }
  if (spawnedTile !== undefined && map.isValidRef(spawnedTile)) {
    candidates.push(spawnedTile);
  }
  for (const tile of candidates) {
    if (map.isLand(tile)) return tile;
  }

  // Deterministic fallback for procedurally generated nations. Select a
  // stable land tile from the seeded map order so generated nations do not
  // all receive the same capital.
  const target = simpleHash(fallbackSeed);
  let landIndex = 0;
  for (let y = 0; y < map.height(); y++) {
    for (let x = 0; x < map.width(); x++) {
      const tile = map.ref(x, y);
      if (!map.isLand(tile)) continue;
      if (landIndex === target % Math.max(1, map.numLandTiles())) return tile;
      landIndex++;
    }
  }
  throw new Error(
    `Cannot resolve a capital on a map without land: ${map.width()}x${map.height()}`,
  );
}

/** Build the panel-ready national summary from the existing game state. */
export function deriveNationalSummary(
  game: Game,
  nation: Nation,
  originalTerritoryTiles = 0,
  capitalTileOverride?: TileRef,
  wasLiberated = false,
): NationalSummary | null {
  const player = game.player(nation.playerInfo.id);
  if (player.type() === PlayerType.Bot) return null;
  if (!player.hasSpawned()) return null;

  const capitalTile =
    capitalTileOverride ??
    resolveCapitalTile(game.map(), nation, player.spawnTile());
  const capitalOwner = game.owner(capitalTile);
  const capitalOwned = capitalOwner.isPlayer() && capitalOwner === player;
  const baseline = Math.max(originalTerritoryTiles, player.numTilesOwned(), 1);
  const territoryFraction = Math.min(1, player.numTilesOwned() / baseline);

  const capitalNeighbors: TileRef[] = [0, 0, 0, 0];
  const neighborCount = game.neighbors4(capitalTile, capitalNeighbors);
  let hostileNeighbors = 0;
  for (let i = 0; i < neighborCount; i++) {
    const owner = game.owner(capitalNeighbors[i]);
    if (owner.isPlayer() && owner !== player && !player.isFriendly(owner)) {
      hostileNeighbors++;
    }
  }
  const threatened = deriveCapitalThreatened(game, player, capitalTile);
  const encircled = neighborCount > 0 && hostileNeighbors === neighborCount;
  const contested =
    player.incomingAttacks().length > 0 || player.outgoingAttacks().length > 0;
  const activeIncomingAttack = player
    .incomingAttacks()
    .some((attack) => attack.isActive());
  const occupationResistance = deriveOccupationResistance({
    territoryFraction,
    capitalOwned,
    capitalThreatened: threatened,
    capitalEncircled: encircled,
    hasActiveIncomingAttack: activeIncomingAttack,
  });

  const enemies = player
    .allRelationsSorted()
    .filter(({ relation }) => relation === Relation.Hostile)
    .map(({ player: other }) => other.id());

  const locations = deriveStrategicLocations(
    player,
    capitalOwner,
    capitalTile,
    game,
  );

  return {
    nationID: player.id(),
    displayName: player.displayName(),
    doctrine: resolveNationDoctrine(player.id()),
    capital: {
      id: `${player.id()}:capital`,
      type: StrategicLocationType.Capital,
      ownerID: capitalOwner.isPlayer() ? capitalOwner.id() : null,
      tile: capitalTile,
    },
    authorityState: deriveAuthorityState({
      isAlive: player.isAlive(),
      territoryFraction,
      capitalOwned,
      capitalThreatened: threatened,
      capitalEncircled: encircled,
      contested,
      wasLiberated,
    }),
    territoryTiles: player.numTilesOwned(),
    territoryFraction,
    troops: player.troops(),
    gold: player.gold(),
    cities: player.unitCount(UnitType.City),
    ports: player.unitCount(UnitType.Port),
    factories: player.unitCount(UnitType.Factory),
    locations,
    allies: player.allies().map((ally) => ally.id()),
    enemies,
    capitalThreatened: threatened,
    capitalEncircled: encircled,
    occupationResistance,
    stability: 100 - occupationResistance,
    supply: 100,
    overextension: 0,
    warExhaustion: 0,
    productionModifier: 1,
  };
}

export interface NationalStateSnapshot {
  nationID: PlayerID;
  capitalTile: TileRef;
  locations: StrategicLocation[];
  doctrine: NationDoctrine;
  occupationResistance: number;
  stability: number;
  authorityState: AuthorityState;
  territoryFraction: number;
  capitalThreatened: boolean;
  capitalEncircled: boolean;
  supply: number;
  overextension: number;
  warExhaustion: number;
  productionModifier: number;
  allies: PlayerID[];
  enemies: PlayerID[];
  territoryDelta: number;
}

export interface NationalEventSnapshot {
  event: NationalEventType;
  nationID: PlayerID;
  /** Player responsible for a capture/liberation, when the map has one. */
  relatedNationID?: PlayerID;
  tile: TileRef;
  locationID?: string;
  locationType?: StrategicLocationType;
}

interface TrackedNation {
  nation: Nation;
  capitalTile: TileRef;
  originalTerritoryTiles: number;
  previous?: NationalSummary;
  milestones: Set<NationalEventType>;
  warExhaustion: number;
  occupationResistance: number | null;
  liberatedUntilTick: Tick | null;
  liberationAttempted: boolean;
  initialLocations?: StrategicLocation[];
}

const LIBERATION_AUTHORITY_TICKS = 50;

/**
 * Tracks only derived national state. It never issues attacks, changes
 * ownership, or modifies player resources.
 */
export class NationalFramingTracker {
  private readonly tracked = new Map<PlayerID, TrackedNation>();

  constructor(private readonly game: Game) {
    const register = (nation: Nation) => {
      if (!game.hasPlayer(nation.playerInfo.id)) return;
      this.tracked.set(nation.playerInfo.id, {
        nation,
        capitalTile: resolveCapitalTile(
          game.map(),
          nation,
          undefined,
          nation.playerInfo.id,
        ),
        originalTerritoryTiles: 0,
        milestones: new Set(),
        warExhaustion: 0,
        occupationResistance: null,
        liberatedUntilTick: null,
        liberationAttempted: false,
      });
    };
    for (const nation of game.nations()) {
      register(nation);
    }
    for (const player of game.allPlayers()) {
      if (player.type() !== PlayerType.Human) continue;
      if (this.tracked.has(player.id())) continue;
      register(new Nation(undefined, player.info()));
    }
  }

  evaluate(): {
    states: NationalStateSnapshot[];
    events: NationalEventSnapshot[];
  } {
    const states: NationalStateSnapshot[] = [];
    const events: NationalEventSnapshot[] = [];

    for (const tracked of this.tracked.values()) {
      if (!this.game.hasPlayer(tracked.nation.playerInfo.id)) continue;
      const player = this.game.player(tracked.nation.playerInfo.id);
      if (
        tracked.originalTerritoryTiles === 0 &&
        player.spawnTile() !== undefined
      ) {
        tracked.capitalTile = resolveCapitalTile(
          this.game.map(),
          tracked.nation,
          player.spawnTile(),
          tracked.nation.playerInfo.id,
        );
      }
      if (tracked.originalTerritoryTiles === 0 && player.numTilesOwned() > 0) {
        tracked.originalTerritoryTiles = player.numTilesOwned();
      }
      const previous = tracked.previous;
      const capitalOwner = this.game.owner(tracked.capitalTile);
      const capitalOwned =
        capitalOwner.isPlayer() &&
        capitalOwner.id() === tracked.nation.playerInfo.id;
      const capitalRecaptured =
        previous !== undefined &&
        previous.capital.ownerID !== tracked.nation.playerInfo.id &&
        capitalOwned;
      if (capitalRecaptured) {
        tracked.liberatedUntilTick =
          this.game.ticks() + LIBERATION_AUTHORITY_TICKS;
      }
      const wasLiberated =
        tracked.liberatedUntilTick !== null &&
        this.game.ticks() <= tracked.liberatedUntilTick;
      const summary = deriveNationalSummary(
        this.game,
        tracked.nation,
        tracked.originalTerritoryTiles,
        tracked.capitalTile,
        wasLiberated,
      );
      if (summary === null) continue;

      const activeGeographicLocations = summary.locations.filter(
        isDynamicGeographicLocation,
      );
      const persistentLocations = summary.locations.filter(
        (location) => !isDynamicGeographicLocation(location),
      );
      tracked.initialLocations ??= persistentLocations.map((location) => ({
        ...location,
        ownerID: tracked.nation.playerInfo.id,
        threatened: false,
      }));
      const knownLocationIDs = new Set(
        tracked.initialLocations.map((location) => location.id),
      );
      for (const location of persistentLocations) {
        if (knownLocationIDs.has(location.id)) continue;
        tracked.initialLocations.push({
          ...location,
          ownerID: tracked.nation.playerInfo.id,
          threatened: false,
        });
        knownLocationIDs.add(location.id);
      }
      summary.locations = [
        ...refreshStrategicLocations(this.game, player, tracked.initialLocations),
        ...refreshStrategicLocations(
          this.game,
          player,
          activeGeographicLocations,
        ),
      ];
      const refreshedCapital = summary.locations.find(
        (location) => location.type === StrategicLocationType.Capital,
      );
      if (refreshedCapital !== undefined) {
        summary.capital = refreshedCapital;
      }

      const activeIncomingAttacks = player
        .incomingAttacks()
        .filter((attack) => attack.isActive());
      const activeOutgoingAttacks = player
        .outgoingAttacks()
        .filter((attack) => attack.isActive());
      const committedTroops = activeOutgoingAttacks.reduce(
        (total, attack) => total + attack.troops(),
        0,
      );
      summary.overextension = deriveOverextension({
        territoryTiles: summary.territoryTiles,
        baselineTerritoryTiles: tracked.originalTerritoryTiles,
        activeOutgoingAttacks: activeOutgoingAttacks.length,
        committedTroops,
        troopCapacity: this.game.config().maxTroops(player),
      });
      summary.supply = deriveSupply({
        territoryFraction: summary.territoryFraction,
        capitalThreatened: summary.capitalThreatened,
        capitalEncircled: summary.capitalEncircled,
        activeIncomingAttacks: activeIncomingAttacks.length,
        activeOutgoingAttacks: activeOutgoingAttacks.length,
        committedTroops,
        troopCapacity: this.game.config().maxTroops(player),
        overextension: summary.overextension,
        logisticsHubs: player.unitCount(UnitType.LogisticsHub),
      });
      const capitalIsOwned = summary.capital.ownerID === summary.nationID;
      const resistanceTarget = deriveOccupationResistance({
        territoryFraction: summary.territoryFraction,
        capitalOwned: capitalIsOwned,
        capitalThreatened: summary.capitalThreatened,
        capitalEncircled: summary.capitalEncircled,
        hasActiveIncomingAttack: activeIncomingAttacks.length > 0,
      });
      tracked.occupationResistance = advanceOccupationResistance(
        tracked.occupationResistance,
        resistanceTarget,
        capitalIsOwned &&
          activeIncomingAttacks.length === 0 &&
          activeOutgoingAttacks.length === 0,
      );
      summary.occupationResistance = tracked.occupationResistance;
      summary.stability = 100 - summary.occupationResistance;
      tracked.warExhaustion = advanceWarExhaustion(
        tracked.warExhaustion,
        activeIncomingAttacks.length + activeOutgoingAttacks.length > 0,
        summary.supply,
        previous === undefined
          ? 0
          : previous.territoryFraction - summary.territoryFraction,
      );
      summary.warExhaustion = tracked.warExhaustion;
      summary.productionModifier = deriveNationalProductionModifier({
        territoryFraction: summary.territoryFraction,
        activeIncomingAttacks: activeIncomingAttacks.length,
        activeOutgoingAttacks: activeOutgoingAttacks.length,
        industrialRegions: summary.factories,
        majorCities: summary.cities,
        warExhaustion: summary.warExhaustion,
        capitalThreatened: summary.capitalThreatened,
        capitalEncircled: summary.capitalEncircled,
        capitalOccupied: summary.capital.ownerID !== summary.nationID,
        occupationResistance: summary.occupationResistance,
        overextension: summary.overextension,
      });

      states.push({
        nationID: summary.nationID,
        capitalTile: summary.capital.tile,
        locations: summary.locations,
        doctrine: summary.doctrine,
        occupationResistance: summary.occupationResistance,
        stability: summary.stability,
        authorityState: summary.authorityState,
        territoryFraction: summary.territoryFraction,
        capitalThreatened: summary.capitalThreatened,
        capitalEncircled: summary.capitalEncircled,
        supply: summary.supply,
        overextension: summary.overextension,
        warExhaustion: summary.warExhaustion,
        productionModifier: summary.productionModifier,
        allies: summary.allies,
        enemies: summary.enemies,
        territoryDelta:
          previous === undefined
            ? 0
            : summary.territoryTiles - previous.territoryTiles,
      });

      const milestoneInput = {
        summary,
        hasActiveIncomingAttack: activeIncomingAttacks.length > 0,
        isAlive: player.isAlive(),
        territoryGained:
          previous === undefined
            ? 0
            : Math.max(0, summary.territoryTiles - previous.territoryTiles),
        regionThreshold: Math.max(
          1,
          Math.round(tracked.originalTerritoryTiles * 0.05),
        ),
      };
      for (const milestone of deriveNationalMilestones(milestoneInput)) {
        if (tracked.milestones.has(milestone)) continue;
        tracked.milestones.add(milestone);
        if (previous === undefined) continue;
        events.push({
          event: milestone,
          nationID: summary.nationID,
          tile: summary.capital.tile,
        });
      }
      if (previous !== undefined) {
        const capitalOccupied =
          summary.capital.ownerID !== null &&
          summary.capital.ownerID !== summary.nationID;
        const liberationInProgress =
          capitalOccupied &&
          summary.occupationResistance >= 40 &&
          activeOutgoingAttacks.some((attack) => {
            const target = attack.target();
            return (
              target.isPlayer() && target.id() === summary.capital.ownerID
            );
          });
        if (liberationInProgress && !tracked.liberationAttempted) {
          tracked.liberationAttempted = true;
          events.push({
            event: NationalEventType.LiberationAttempted,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (!capitalOccupied) {
          tracked.liberationAttempted = false;
        }
        if (!previous.capitalThreatened && summary.capitalThreatened) {
          events.push({
            event: NationalEventType.CapitalThreatened,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (previous.capitalThreatened && !summary.capitalThreatened) {
          events.push({
            event: NationalEventType.CapitalSecured,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (
          previous.occupationResistance < 60 &&
          summary.occupationResistance >= 60
        ) {
          events.push({
            event: NationalEventType.ResistanceSurging,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (
          previous.occupationResistance >= 60 &&
          summary.occupationResistance < 60
        ) {
          events.push({
            event: NationalEventType.ResistanceContained,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (previous.productionModifier >= 0.75 && summary.productionModifier < 0.75) {
          events.push({
            event: NationalEventType.ProductionDisrupted,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (
          previous.productionModifier < 0.75 &&
          summary.productionModifier >= 0.75
        ) {
          events.push({
            event: NationalEventType.ProductionRecovered,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        const previousLocations = new Map(
          previous.locations.map((location) => [location.id, location]),
        );
        for (const location of summary.locations) {
          if (location.type === StrategicLocationType.Capital) continue;
          const prior = previousLocations.get(location.id);
          if (prior === undefined) continue;
          if (!prior.threatened && location.threatened) {
            events.push({
              event: NationalEventType.StrategicLocationThreatened,
              nationID: summary.nationID,
              tile: location.tile,
              locationID: location.id,
              locationType: location.type,
            });
          }
          if (
            prior.ownerID === summary.nationID &&
            location.ownerID !== summary.nationID
          ) {
            events.push({
              event: NationalEventType.StrategicLocationCaptured,
              nationID: summary.nationID,
              relatedNationID: location.ownerID ?? undefined,
              tile: location.tile,
              locationID: location.id,
              locationType: location.type,
            });
          } else if (
            prior.ownerID !== summary.nationID &&
            location.ownerID === summary.nationID
          ) {
            events.push({
              event: NationalEventType.StrategicLocationSecured,
              nationID: summary.nationID,
              tile: location.tile,
              locationID: location.id,
              locationType: location.type,
            });
          }
        }
        if (previous.supply >= 40 && summary.supply < 40) {
          events.push({
            event: NationalEventType.SupplyCrisis,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (previous.supply < 40 && summary.supply >= 40) {
          events.push({
            event: NationalEventType.SupplyRestored,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (previous.warExhaustion < 70 && summary.warExhaustion >= 70) {
          events.push({
            event: NationalEventType.WarExhaustionHigh,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (
          previous.warExhaustion >= 70 &&
          summary.warExhaustion < 70
        ) {
          events.push({
            event: NationalEventType.WarExhaustionRecovered,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (previous.overextension < 70 && summary.overextension >= 70) {
          events.push({
            event: NationalEventType.OverextensionHigh,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        } else if (
          previous.overextension >= 70 &&
          summary.overextension < 70
        ) {
          events.push({
            event: NationalEventType.OverextensionRecovered,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (!previous.capitalEncircled && summary.capitalEncircled) {
          events.push({
            event: NationalEventType.CapitalEncircled,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (previous.capital.ownerID !== summary.capital.ownerID) {
          if (summary.capital.ownerID !== summary.nationID) {
            events.push({
              event: NationalEventType.CapitalCaptured,
              nationID: summary.nationID,
              relatedNationID: summary.capital.ownerID ?? undefined,
              tile: summary.capital.tile,
            });
          } else if (
            previous.capital.ownerID !== summary.nationID &&
            summary.capital.ownerID === summary.nationID
          ) {
            events.push({
              event: NationalEventType.NationLiberated,
              nationID: summary.nationID,
              relatedNationID: previous.capital.ownerID ?? undefined,
              tile: summary.capital.tile,
            });
          }
        }
        if (
          previous.authorityState !== AuthorityState.PartiallyOccupied &&
          summary.authorityState === AuthorityState.PartiallyOccupied
        ) {
          events.push({
            event: NationalEventType.NationPartiallyOccupied,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
        if (
          previous.authorityState !== AuthorityState.FullyOccupied &&
          !player.isAlive()
        ) {
          events.push({
            event: NationalEventType.NationEliminated,
            nationID: summary.nationID,
            tile: summary.capital.tile,
          });
        }
      }
      tracked.previous = summary;
    }

    return { states, events };
  }
}
