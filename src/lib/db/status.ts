export type CampaignStatus = "UPCOMING" | "PREPARING" | "LIVE" | "ENDING SOON" | "COMPLETED" | "CANCELLED";
export type PromotionStatus = "UPCOMING" | "LIVE" | "ENDING SOON" | "EXPIRED" | "EXPIRED – ACTION REQUIRED";

const ENDING_SOON_DAYS = 5;
const PREPARING_DAYS = 14;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Campaign status from its date range. Manual override (CANCELLED, etc.) always wins. */
export function computeCampaignStatus(
  startDate: string | null,
  endDate: string | null,
  override: string | null,
  today: Date = new Date()
): CampaignStatus {
  if (override) return override as CampaignStatus;
  if (!startDate || !endDate) return "PREPARING";

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  if (daysBetween(today, start) > 0) {
    return daysBetween(today, start) <= PREPARING_DAYS ? "PREPARING" : "UPCOMING";
  }
  if (daysBetween(today, end) < 0) return "COMPLETED";
  if (daysBetween(today, end) <= ENDING_SOON_DAYS) return "ENDING SOON";
  return "LIVE";
}

/**
 * Promotion status from dates. `stillActiveSignal` is true when the source data
 * (e.g. website banner still live, in-store display not yet removed) indicates the
 * promotion is still physically active past its end date — flags EXPIRED as needing
 * action rather than silently closed.
 */
export function computePromotionStatus(
  startDate: string | null,
  endDate: string | null,
  override: string | null,
  today: Date = new Date(),
  stillActiveSignal = false
): PromotionStatus {
  if (override) return override as PromotionStatus;
  if (!startDate) return "UPCOMING";

  const start = new Date(startDate + "T00:00:00Z");
  if (daysBetween(today, start) > 0) return "UPCOMING";

  if (!endDate) return "LIVE";
  const end = new Date(endDate + "T00:00:00Z");
  const diffToEnd = daysBetween(today, end);

  if (diffToEnd < 0) return stillActiveSignal ? "EXPIRED – ACTION REQUIRED" : "EXPIRED";
  if (diffToEnd <= ENDING_SOON_DAYS) return "ENDING SOON";
  return "LIVE";
}

export function daysRemaining(endDate: string | null, today: Date = new Date()): number | null {
  if (!endDate) return null;
  return daysBetween(today, new Date(endDate + "T00:00:00Z"));
}
