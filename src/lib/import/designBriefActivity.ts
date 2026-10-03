import type { ActivityType } from "../db/types";

export interface ActivityClassification {
  activityType: ActivityType;
  activityLabel: string;
}

/** Standard Activity Taxonomy (see spec): CAMPAIGN / PROMOTION / IN-STORE /
 *  DIGITAL / A&P / OTHER, each with a specific label. Activity is the parent of
 *  one or more Design Assets — never the same thing as Asset Type (Wobbler,
 *  TVC...). Classification is deterministic from signals already extracted by
 *  the parser (sheet_kind, campaign_type, per-asset channel/promotion_channel)
 *  — never guessed beyond what those signals support. */
export function classifyActivity(input: {
  sheetKind: string;
  campaignType: string | null;
  channel: string;
  promotionChannel: string | null;
  reusableTemplate: boolean;
}): ActivityClassification {
  const { sheetKind, campaignType, channel, promotionChannel, reusableTemplate } = input;

  // CAMPAIGN — Monthly/Golden Week/Double Date/Seasonal/Brand Campaign.
  const CAMPAIGN_CODE_LABELS: Record<string, string> = {
    MO: "Monthly Campaign",
    GW: "Golden Week",
    DD: "Double Date",
  };
  if (sheetKind === "CAMPAIGN_BRIEF" || sheetKind === "LANDING_PAGE") {
    if (campaignType && CAMPAIGN_CODE_LABELS[campaignType]) {
      return { activityType: "CAMPAIGN", activityLabel: CAMPAIGN_CODE_LABELS[campaignType] };
    }
    if (campaignType === "LP") {
      return { activityType: "PROMOTION", activityLabel: "LGD Plus" };
    }
    if (campaignType === "Clearance") {
      return { activityType: "PROMOTION", activityLabel: "Clearance" };
    }
    // Per-asset promotion channel present but no formal campaign code — this is
    // a channel-specific Promotion activity, not a generic Campaign.
    if (promotionChannel === "IN-STORE") return { activityType: "PROMOTION", activityLabel: "In-store Promotion" };
    if (promotionChannel === "ONLINE RETAIL") return { activityType: "PROMOTION", activityLabel: "Retail Online Promotion" };
    if (promotionChannel === "BULK/WHOLESALE") return { activityType: "PROMOTION", activityLabel: "Wholesale Promotion" };
    if (promotionChannel === "LAST MILE") return { activityType: "PROMOTION", activityLabel: "Last Mile Promotion" };
    // No campaign code, no channel signal — a brand-led creative campaign brief
    // (e.g. a single-brand sheet with no formal MO/GW code).
    return { activityType: "CAMPAIGN", activityLabel: "Brand Campaign" };
  }

  if (sheetKind === "DEMO_BRIEF") {
    return { activityType: "IN-STORE", activityLabel: "Demo / Tasting" };
  }

  if (sheetKind === "GONDOLA_FIXTURE") {
    return { activityType: "IN-STORE", activityLabel: "Fixture / Branding" };
  }

  if (sheetKind === "PROMOTION_LABEL_TAG" || sheetKind === "PROMOTION_LABEL_SKU") {
    const label = reusableTemplate ? "In-store Promotion" : "Clearance";
    return { activityType: "PROMOTION", activityLabel: label };
  }

  if (sheetKind === "EMAIL_BRIEF") {
    return { activityType: "DIGITAL", activityLabel: "eNews / Email Marketing" };
  }

  // Fallback: infer from the ASSET's own channel when the sheet-level kind is
  // generic (CAMPAIGN_BRIEF assets can be Digital/In-store/Social individually).
  if (channel === "IN-STORE") return { activityType: "IN-STORE", activityLabel: "Store Display" };
  if (channel === "DIGITAL") return { activityType: "DIGITAL", activityLabel: "Video" };
  if (channel === "WEBSITE") return { activityType: "DIGITAL", activityLabel: "Website" };
  if (channel === "SOCIAL") return { activityType: "DIGITAL", activityLabel: "Social Media" };
  if (channel === "EMAIL") return { activityType: "DIGITAL", activityLabel: "eNews / Email Marketing" };
  if (channel === "DEMO") return { activityType: "IN-STORE", activityLabel: "Demo / Tasting" };
  if (channel === "PROMOTION SUPPORT") return { activityType: "PROMOTION", activityLabel: "In-store Promotion" };
  if (channel === "FIXTURE/BRANDING") return { activityType: "IN-STORE", activityLabel: "Fixture / Branding" };

  return { activityType: "OTHER", activityLabel: "Other" };
}
