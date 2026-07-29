import { simpleHash } from "../Util";
import { UnitType } from "./Game";

/** Strategic identity used to bias the existing nation AI priorities. */
export enum NationDoctrine {
  Expansionist = "expansionist",
  Fortress = "fortress",
  Opportunist = "opportunist",
  Coalitionist = "coalitionist",
  Economic = "economic",
  Naval = "naval",
}

const DOCTRINES = Object.values(NationDoctrine);

/** Stable across workers and replays for a given nation identifier. */
export function resolveNationDoctrine(nationID: string): NationDoctrine {
  return DOCTRINES[simpleHash(nationID) % DOCTRINES.length];
}

export function nationDoctrineLabel(doctrine: NationDoctrine): string {
  return doctrine.charAt(0).toUpperCase() + doctrine.slice(1);
}

/**
 * Structure priorities are doctrine signals, not a second construction
 * system. NationStructureBehavior still applies all existing affordability,
 * spacing, unit-disable, and upgrade rules after this ordering is selected.
 */
export function structurePriorityForDoctrine(
  doctrine?: NationDoctrine,
): UnitType[] {
  switch (doctrine) {
    case NationDoctrine.Economic:
      return [
        UnitType.Factory,
        UnitType.LogisticsHub,
        UnitType.Port,
        UnitType.SAMLauncher,
        UnitType.MissileSilo,
      ];
    case NationDoctrine.Fortress:
      return [
        UnitType.SAMLauncher,
        UnitType.LogisticsHub,
        UnitType.Factory,
        UnitType.Port,
        UnitType.MissileSilo,
      ];
    case NationDoctrine.Naval:
    default:
      return [
        UnitType.Port,
        UnitType.LogisticsHub,
        UnitType.Factory,
        UnitType.SAMLauncher,
        UnitType.MissileSilo,
      ];
  }
}
