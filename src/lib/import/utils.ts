import { weekCodeForDate } from "../db/weeks";

export function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date (1900 system)
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime()) && /\d{4}/.test(trimmed)) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function cleanStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "" || s === "?" || s === "-" || s === " ") return null;
  return s;
}

export interface ParsedCampaignCode {
  raw: string;
  campaignType: string;
  monthToken: string | null;
  weekCode: string | null;
  displayName: string;
}

const KNOWN_TYPES: Record<string, string> = {
  MO: "Monthly Campaign",
  GW: "Golden Week",
  LP: "Longdan Plus",
  LM: "Last Mile",
  DD: "Double Date",
  Clearance: "Clearance Sales",
  SO: "Special Offer",
  VDQ: "Volume Deal",
  CD: "Category Deal",
  RTO: "Retail Online",
  WSO: "Wholesale Online",
  ER: "Email/Retail",
};

/** Parses Longdan campaign codes like "MO-Halloween-Oct26-W40" or "Clearance-Jul26-W27". */
export function parseCampaignCode(raw: string): ParsedCampaignCode {
  const parts = raw.split("-").map((p) => p.trim()).filter(Boolean);
  const weekPart = parts.find((p) => /^W\d{1,2}$/i.test(p)) ?? null;
  const weekCode = weekPart ? `W${weekPart.replace(/^W/i, "").padStart(2, "0")}` : null;
  const typeKey = parts[0] ?? raw;
  const middle = parts.filter((p) => p !== parts[0] && p !== weekPart);
  const typeLabel = KNOWN_TYPES[typeKey] ?? typeKey;
  const displayName = middle.length > 0 ? `${typeLabel} — ${middle.join(" ")}` : typeLabel;
  return {
    raw,
    campaignType: typeKey,
    monthToken: middle[middle.length - 1] ?? null,
    weekCode,
    displayName,
  };
}

export function weekCodeFromDateOrCode(dateIso: string | null, code: ParsedCampaignCode): string | null {
  if (code.weekCode) return code.weekCode;
  if (dateIso) return weekCodeForDate(dateIso);
  return null;
}

const MONTH_ABBR: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
};

/** "Oct26" -> "October 2026". Falls back to the raw token if it doesn't parse. */
export function monthTokenToLabel(token: string | null): string | null {
  if (!token) return null;
  const m = token.match(/^([A-Za-z]{3})(\d{2})$/);
  if (!m) return token;
  const month = MONTH_ABBR[m[1].toLowerCase()];
  if (!month) return token;
  return `${month} 20${m[2]}`;
}

/** The parent CAMPAIGN identity for a promo code — same type+month, week dropped.
 *  e.g. "MO-Halloween-Oct26-W40" and "MO-Something-Oct26-W41" both group under "MO-Oct26". */
export function campaignGroupId(code: ParsedCampaignCode): string {
  return `${code.campaignType}-${code.monthToken ?? "General"}`;
}

export function campaignGroupName(code: ParsedCampaignCode): string {
  const typeLabel = code.displayName.split(" — ")[0];
  const monthLabel = monthTokenToLabel(code.monthToken);
  return monthLabel ? `${typeLabel} — ${monthLabel}` : typeLabel;
}

import type { ActivationType } from "../db/types";

/** Deterministic classification only — no invented driver beyond what the campaign_type itself implies.
 *  A. Core Campaign: Monthly Campaign, Golden Week.
 *  B. Commercial Programme: Clearance, Longdan Plus, Double Date, Volume/Category Deal.
 *  C. Tactical Activation: everything else (Special Offer, weekly/exceptional codes, unrecognised types). */
const CORE_TYPES = new Set(["MO", "GW"]);
const COMMERCIAL_TYPES = new Set(["Clearance", "LP", "DD", "VDQ", "VDQ3", "VDQ4", "CD"]);

export function classifyActivation(campaignType: string): { activationType: ActivationType; driver: string | null } {
  if (CORE_TYPES.has(campaignType)) return { activationType: "CORE_CAMPAIGN", driver: null };
  if (COMMERCIAL_TYPES.has(campaignType)) {
    // Clearance is definitionally stock rotation — safe to state; other commercial
    // programme drivers aren't derivable from the code alone, so left null.
    return { activationType: "COMMERCIAL_PROGRAMME", driver: campaignType === "Clearance" ? "OVERSTOCK_BBD" : null };
  }
  return { activationType: "TACTICAL_ACTIVATION", driver: null };
}

export function slugify(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
