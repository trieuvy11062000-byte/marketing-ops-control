import { getDb } from "../db/client";
import { computePromotionStatus, daysRemaining, type PromotionStatus } from "../db/status";
import type { Promotion } from "../db/types";

export interface PromotionWithStatus extends Promotion {
  status: PromotionStatus;
  days_remaining: number | null;
  brand_name: string | null;
  campaign_name: string | null;
}

const BASE_SQL = `
  SELECT p.*, b.name as brand_name, c.name as campaign_name
  FROM promotions p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN campaigns c ON c.id = p.campaign_id
`;

function withStatus(row: Promotion & { brand_name: string | null; campaign_name: string | null }): PromotionWithStatus {
  return {
    ...row,
    status: computePromotionStatus(row.start_date, row.end_date, row.status_override),
    days_remaining: daysRemaining(row.end_date),
  };
}

export type PromotionQuickFilter = "LIVE NOW" | "UPCOMING" | "ENDING SOON" | "EXPIRED" | "AT RISK" | "ALL";

export interface PromotionFilters {
  quick?: PromotionQuickFilter;
  channel?: string;
  brandId?: string;
  campaignId?: string;
  sku?: string;
}

export function listPromotions(filters: PromotionFilters = {}): PromotionWithStatus[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.channel) {
    clauses.push("p.channel = ?");
    params.push(filters.channel);
  }
  if (filters.brandId) {
    clauses.push("p.brand_id = ?");
    params.push(filters.brandId);
  }
  if (filters.campaignId) {
    clauses.push("p.campaign_id = ?");
    params.push(filters.campaignId);
  }
  if (filters.sku) {
    clauses.push("(p.sku_code LIKE ? OR p.sku_name LIKE ?)");
    params.push(`%${filters.sku}%`, `%${filters.sku}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`${BASE_SQL} ${where} ORDER BY p.end_date`).all(...params) as (Promotion & {
    brand_name: string | null;
    campaign_name: string | null;
  })[];

  let withStatuses = rows.map(withStatus);

  const quick = filters.quick ?? "LIVE NOW";
  switch (quick) {
    case "LIVE NOW":
      withStatuses = withStatuses.filter((p) => p.status === "LIVE" || p.status === "ENDING SOON");
      break;
    case "UPCOMING":
      withStatuses = withStatuses.filter((p) => p.status === "UPCOMING");
      break;
    case "ENDING SOON":
      withStatuses = withStatuses.filter((p) => p.status === "ENDING SOON");
      break;
    case "EXPIRED":
      withStatuses = withStatuses.filter((p) => p.status === "EXPIRED" || p.status === "EXPIRED – ACTION REQUIRED");
      break;
    case "AT RISK":
      withStatuses = withStatuses.filter((p) => p.status === "EXPIRED – ACTION REQUIRED" || p.setup_status === "PENDING");
      break;
    case "ALL":
      break;
  }

  return withStatuses;
}

export function getPromotion(id: string): PromotionWithStatus | undefined {
  const db = getDb();
  const row = db.prepare(`${BASE_SQL} WHERE p.id = ?`).get(id) as
    | (Promotion & { brand_name: string | null; campaign_name: string | null })
    | undefined;
  return row ? withStatus(row) : undefined;
}

/** Same SKU, other channel/promotion records — makes channel differences immediately visible. */
export function getRelatedPromotions(skuCode: string | null, excludeId: string): PromotionWithStatus[] {
  if (!skuCode) return [];
  const db = getDb();
  const rows = db.prepare(`${BASE_SQL} WHERE p.sku_code = ? AND p.id != ?`).all(skuCode, excludeId) as (Promotion & {
    brand_name: string | null;
    campaign_name: string | null;
  })[];
  return rows.map(withStatus);
}

export interface PromotionTopSummary {
  live: number;
  endingSoon: number;
  stockIssue: number;
  auditIssue: number;
}

/** Top summary strip — informational, not fabricated. STOCK ISSUE = a source stock
 *  flag exists while the promotion is currently live/ending. AUDIT ISSUE = execution
 *  window has started but audit_status is still PENDING (excludes UPCOMING, where
 *  audit can't have happened yet). */
export function getPromotionTopSummary(): PromotionTopSummary {
  const all = listPromotions({ quick: "ALL" });
  return {
    live: all.filter((p) => p.status === "LIVE").length,
    endingSoon: all.filter((p) => p.status === "ENDING SOON").length,
    stockIssue: all.filter((p) => p.stock_status && (p.status === "LIVE" || p.status === "ENDING SOON")).length,
    auditIssue: all.filter((p) => p.audit_status === "PENDING" && p.status !== "UPCOMING").length,
  };
}

export function getPromotionQuickCounts(): Record<PromotionQuickFilter, number> {
  const all = listPromotions({ quick: "ALL" });
  return {
    "LIVE NOW": all.filter((p) => p.status === "LIVE" || p.status === "ENDING SOON").length,
    UPCOMING: all.filter((p) => p.status === "UPCOMING").length,
    "ENDING SOON": all.filter((p) => p.status === "ENDING SOON").length,
    EXPIRED: all.filter((p) => p.status === "EXPIRED" || p.status === "EXPIRED – ACTION REQUIRED").length,
    "AT RISK": all.filter((p) => p.status === "EXPIRED – ACTION REQUIRED" || p.setup_status === "PENDING").length,
    ALL: all.length,
  };
}
