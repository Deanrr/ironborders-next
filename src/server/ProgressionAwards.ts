import type { CampaignDebriefWire } from "../core/Schemas";
import { experienceForDebrief } from "../core/game/MatchChronicle";
import { logger } from "./Logger";
import { ServerEnv } from "./ServerEnv";

const log = logger.child({ component: "ProgressionAwards" });

/**
 * Send one server-derived match result to the account service.
 *
 * The account service treats `Idempotency-Key` as the unique award key. The
 * game server derives accountId from the authenticated connection's publicId;
 * clients never submit it. XP is recomputed from the debrief counters here,
 * so the informational experienceEarned field cannot be inflated by a client.
 */
export async function awardProgression(
  matchId: string,
  accountId: string,
  debrief: CampaignDebriefWire,
): Promise<void> {
  if (!ServerEnv.runtimeFeatures().progression || accountId.length === 0) {
    return;
  }

  const experienceEarned = experienceForDebrief(debrief, debrief.victory);
  const payload = {
    matchId,
    accountId,
    experienceEarned,
    result: {
      ...debrief,
      experienceEarned,
    },
  };

  try {
    const response = await fetch(`${ServerEnv.jwtIssuer()}/progression/award`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ServerEnv.apiKey(),
        "Idempotency-Key": `${matchId}:${accountId}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      log.warn("progression award rejected", {
        matchId,
        accountId,
        status: response.status,
      });
    }
  } catch (error) {
    log.warn("progression award request failed", {
      matchId,
      accountId,
      error: String(error),
    });
  }
}
