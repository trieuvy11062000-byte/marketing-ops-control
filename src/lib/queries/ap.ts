import { getDb } from "../db/client";
import type { ApCampaignReport, ApDealTrackerItem, ApDeliveryLine, ApPackage, Deliverable } from "../db/types";

export type ApQuickFilter =
  | "ACTIVE PACKAGE"
  | "REPORT DUE"
  | "MISSING DATA"
  | "AWAITING EVIDENCE"
  | "READY TO REPORT"
  | "REPORTED"
  | "ALL";

export interface ApPackageWithSummary extends ApPackage {
  brand_name: string | null;
  line_count: number;
  reported_count: number;
  complete_count: number;
  partial_count: number;
  pending_count: number;
}

const SUMMARY_SQL = `
  SELECT p.*, b.name as brand_name,
         COUNT(l.id) as line_count,
         SUM(CASE WHEN l.reported = 1 THEN 1 ELSE 0 END) as reported_count,
         SUM(CASE WHEN l.evidence_status = 'COMPLETE' THEN 1 ELSE 0 END) as complete_count,
         SUM(CASE WHEN l.evidence_status = 'PARTIAL' THEN 1 ELSE 0 END) as partial_count,
         SUM(CASE WHEN l.evidence_status = 'PENDING' THEN 1 ELSE 0 END) as pending_count
  FROM ap_packages p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN ap_delivery_lines l ON l.package_id = p.id
  GROUP BY p.id
`;

export function listApPackages(quick: ApQuickFilter = "ALL"): ApPackageWithSummary[] {
  const db = getDb();
  const rows = db.prepare(`${SUMMARY_SQL} ORDER BY p.name`).all() as ApPackageWithSummary[];

  switch (quick) {
    case "ACTIVE PACKAGE":
      return rows.filter((p) => p.status === "IN DELIVERY");
    case "REPORT DUE":
      return rows.filter((p) => p.reported_count < p.line_count);
    case "MISSING DATA":
      return rows.filter((p) => p.pending_count > 0);
    case "AWAITING EVIDENCE":
      return rows.filter((p) => p.partial_count > 0);
    case "READY TO REPORT":
      return rows.filter((p) => p.complete_count === p.line_count && p.line_count > 0 && p.reported_count < p.line_count);
    case "REPORTED":
      return rows.filter((p) => p.line_count > 0 && p.reported_count === p.line_count);
    case "ALL":
    default:
      return rows;
  }
}

export interface ApBrandDeliveryRow {
  brand_id: string;
  brand_name: string;
  package_count: number;
  line_count: number;
  reported_count: number;
  missing_delivery: number;
  missing_data: number;
  status: string;
}

/** Brand Delivery aggregation — never manually ticked. MISSING DELIVERY = an
 *  operational-module-linked line (link_subtype set) with no recorded delivered_quantity.
 *  MISSING DATA = evidence/report not yet captured (evidence_status PENDING or not reported). */
export function getApBrandDelivery(): ApBrandDeliveryRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.brand_id, b.name as brand_name,
              COUNT(DISTINCT p.id) as package_count,
              COUNT(l.id) as line_count,
              SUM(CASE WHEN l.reported = 1 THEN 1 ELSE 0 END) as reported_count,
              SUM(CASE WHEN l.link_subtype IS NOT NULL AND (l.delivered_quantity IS NULL OR l.delivered_quantity = 0) THEN 1 ELSE 0 END) as missing_delivery,
              SUM(CASE WHEN l.evidence_status = 'PENDING' THEN 1 ELSE 0 END) as missing_data,
              MAX(p.status) as status
       FROM ap_packages p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN ap_delivery_lines l ON l.package_id = p.id
       WHERE p.brand_id IS NOT NULL
       GROUP BY p.brand_id
       ORDER BY missing_delivery DESC, missing_data DESC, b.name`
    )
    .all() as ApBrandDeliveryRow[];
}

export function getApPackage(id: string): ApPackageWithSummary | undefined {
  const db = getDb();
  return db.prepare(SUMMARY_SQL.replace("GROUP BY p.id", "WHERE p.id = ? GROUP BY p.id")).get(id) as
    | ApPackageWithSummary
    | undefined;
}

export function getApDeliveryLines(packageId: string): ApDeliveryLine[] {
  const db = getDb();
  return db.prepare("SELECT * FROM ap_delivery_lines WHERE package_id = ? ORDER BY deliverable_type").all(packageId) as ApDeliveryLine[];
}

export function getApDeliveryLine(id: string): (ApDeliveryLine & { package_name: string; brand_name: string | null }) | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT l.*, p.name as package_name, b.name as brand_name
       FROM ap_delivery_lines l JOIN ap_packages p ON p.id = l.package_id LEFT JOIN brands b ON b.id = p.brand_id
       WHERE l.id = ?`
    )
    .get(id) as (ApDeliveryLine & { package_name: string; brand_name: string | null }) | undefined;
}

/** Linked execution records for a delivery line's "View Demo/Digital/POSM Record" cross-link. */
export function getLinkedExecutionRecords(line: Pick<ApDeliveryLine, "link_brand_id" | "link_subtype">): Deliverable[] {
  if (!line.link_brand_id || !line.link_subtype) return [];
  const db = getDb();
  return db
    .prepare("SELECT * FROM deliverables WHERE brand_id = ? AND subtype = ? ORDER BY week_code, location")
    .all(line.link_brand_id, line.link_subtype) as Deliverable[];
}

// ── B. Deal Tracker — commercial/negotiation facts, never execution tasks ──

export function listDealTracker(packageId: string): ApDealTrackerItem[] {
  const db = getDb();
  return db.prepare("SELECT * FROM ap_deal_tracker WHERE package_id = ? ORDER BY sort_order").all(packageId) as ApDealTrackerItem[];
}

// ── A. Proposal — linked Products/SKU (pulled from Design Assets, never duplicated) ──

export interface ApLinkedProduct {
  product_code: string | null;
  product_name: string | null;
  product_group: string | null;
}

export function getApLinkedProducts(brandId: string | null): ApLinkedProduct[] {
  if (!brandId) return [];
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT p.product_code, p.product_name, p.product_group
       FROM design_asset_products p
       JOIN design_assets a ON a.id = p.design_asset_id
       WHERE a.brand_id = ?
       ORDER BY p.product_name`
    )
    .all(brandId) as ApLinkedProduct[];
}

// ── C. Report / Evidence — pulls + summarises execution data, never duplicates it ──

export function getApCampaignReport(packageId: string): ApCampaignReport | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM ap_campaign_reports WHERE package_id = ?").get(packageId) as ApCampaignReport | undefined;
}

export interface ApReportSummary {
  campaigns: { id: string; name: string; campaign_type: string | null; start_date: string | null; end_date: string | null }[];
  designActivities: { id: string; activity_type: string; activity_label: string; month_label: string | null }[];
  demoSessions: { week_code: string; location: string; session_label: string | null }[];
  promotions: { id: string; channel: string; mechanic: string | null; sku_code: string | null }[];
}

/** Pulls execution records already linked to this brand from Campaign, Demo,
 *  Digital/In-store (via Design Assets) and Promotion modules — the Report tab
 *  summarises these, it never stores its own copy. */
export function getApReportSummary(brandId: string | null): ApReportSummary {
  if (!brandId) return { campaigns: [], designActivities: [], demoSessions: [], promotions: [] };
  const db = getDb();
  const campaigns = db.prepare("SELECT id, name, campaign_type, start_date, end_date FROM campaigns WHERE brand_id = ? ORDER BY start_date").all(brandId) as ApReportSummary["campaigns"];
  const designActivities = db
    .prepare(
      `SELECT act.id, act.activity_type, act.activity_label, m.month_label
       FROM design_activities act LEFT JOIN months m ON m.id = act.month_id
       WHERE act.brand_id = ? ORDER BY m.year, m.month_number`
    )
    .all(brandId) as ApReportSummary["designActivities"];
  const demoSessions = db
    .prepare("SELECT DISTINCT week_code, location, session_label FROM deliverables WHERE brand_id = ? AND subtype = 'Demo' ORDER BY week_code")
    .all(brandId) as ApReportSummary["demoSessions"];
  const promotions = db.prepare("SELECT id, channel, mechanic, sku_code FROM promotions WHERE brand_id = ? ORDER BY channel").all(brandId) as ApReportSummary["promotions"];
  return { campaigns, designActivities, demoSessions, promotions };
}
