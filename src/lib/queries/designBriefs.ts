import { getDb } from "../db/client";
import type { Category, DesignAsset, DesignBrief, LeaderAuditState, MonthLedger, Portfolio } from "../db/types";

// ── Monthly Ledger ───────────────────────────────────────────────────────────

export function listMonths(): MonthLedger[] {
  const db = getDb();
  return db.prepare("SELECT * FROM months ORDER BY year, month_number").all() as MonthLedger[];
}

export function getMonth(id: string): MonthLedger | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM months WHERE id = ?").get(id) as MonthLedger | undefined;
}

/** The current/default month to land on — the latest one imported. */
export function getLatestMonth(): MonthLedger | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM months ORDER BY year DESC, month_number DESC LIMIT 1").get() as MonthLedger | undefined;
}

export function getAdjacentMonth(id: string, direction: 1 | -1): MonthLedger | undefined {
  const months = listMonths();
  const idx = months.findIndex((m) => m.id === id);
  if (idx === -1) return undefined;
  return months[idx + direction];
}

// ── Portfolio / Category ─────────────────────────────────────────────────────

export interface PortfolioWithBrandCount extends Portfolio {
  brand_count: number;
}

export function listPortfolios(): PortfolioWithBrandCount[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.*, (SELECT COUNT(DISTINCT da.brand_id) FROM design_activities da WHERE da.portfolio_id = p.id AND da.brand_id IS NOT NULL) as brand_count
       FROM portfolios p ORDER BY p.name`
    )
    .all() as PortfolioWithBrandCount[];
}

export function getPortfolio(id: string): Portfolio | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM portfolios WHERE id = ?").get(id) as Portfolio | undefined;
}

export interface PortfolioBrandRow {
  brand_id: string;
  brand_name: string;
  activity_count: number;
}

/** Brands under a Portfolio — opening one navigates to its normal Brand detail
 *  page, never a separate sub-database (see rule 17 on Portfolio View). */
export function listBrandsForPortfolio(portfolioId: string): PortfolioBrandRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT b.id as brand_id, b.name as brand_name, COUNT(da.id) as activity_count
       FROM design_activities da
       JOIN brands b ON b.id = da.brand_id
       WHERE da.portfolio_id = ?
       GROUP BY b.id
       ORDER BY b.name`
    )
    .all(portfolioId) as PortfolioBrandRow[];
}

export function listCategories(): Category[] {
  const db = getDb();
  return db.prepare("SELECT * FROM categories ORDER BY name").all() as Category[];
}

// ── Monthly Control View — the primary Design Assets table ─────────────────

export interface MonthlyControlRow {
  asset_id: string;
  activity_id: string | null;
  brand_id: string | null;
  brand_name: string | null;
  portfolio_name: string | null;
  activity_type: string | null;
  activity_label: string | null;
  asset_type: string;
  variant_label: string | null;
  channel: string;
  product_count: number;
  promotion_mechanic: string | null;
  promotion_channel: string | null;
  design_deadline: string | null;
  confidence: "HIGH" | "NEEDS MAPPING" | "UNCLEAR";
  campaign_name: string | null;
}

export interface MonthlyControlFilters {
  monthId?: string;
  primary?: string; // "ALL" | "CAMPAIGN" | a channel value
  portfolioId?: string;
  brandId?: string;
  activityType?: string;
  assetType?: string;
  needsMappingOnly?: boolean;
  search?: string;
}

function buildMonthlyControlWhere(filters: MonthlyControlFilters): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.monthId) { clauses.push("a.month_id = ?"); params.push(filters.monthId); }
  if (filters.primary && filters.primary !== "ALL") {
    if (filters.primary === "CAMPAIGN") clauses.push("act.activity_type = 'CAMPAIGN'");
    else { clauses.push("a.channel = ?"); params.push(filters.primary); }
  }
  if (filters.portfolioId) { clauses.push("act.portfolio_id = ?"); params.push(filters.portfolioId); }
  if (filters.brandId) { clauses.push("a.brand_id = ?"); params.push(filters.brandId); }
  if (filters.activityType) { clauses.push("act.activity_type = ?"); params.push(filters.activityType); }
  if (filters.assetType) { clauses.push("a.asset_type = ?"); params.push(filters.assetType); }
  if (filters.needsMappingOnly) { clauses.push("a.confidence != 'HIGH'"); }
  if (filters.search) {
    clauses.push(
      `(b.name LIKE ? OR br.campaign_name LIKE ? OR act.activity_label LIKE ? OR a.asset_type LIKE ?
        OR EXISTS (SELECT 1 FROM design_asset_products p WHERE p.design_asset_id = a.id AND (p.product_name LIKE ? OR p.product_code LIKE ?)))`
    );
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like, like);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const MONTHLY_CONTROL_SQL = `
  SELECT a.id as asset_id, a.activity_id, a.brand_id, b.name as brand_name, pf.name as portfolio_name,
         act.activity_type, act.activity_label, a.asset_type, a.variant_label, a.channel,
         (SELECT COUNT(*) FROM design_asset_products p WHERE p.design_asset_id = a.id) as product_count,
         a.promotion_mechanic, a.promotion_channel, a.design_deadline, a.confidence,
         COALESCE(br.campaign_name, c.name) as campaign_name
  FROM design_assets a
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN design_activities act ON act.id = a.activity_id
  LEFT JOIN portfolios pf ON pf.id = act.portfolio_id
  LEFT JOIN design_briefs br ON br.id = a.design_brief_id
  LEFT JOIN campaigns c ON c.id = a.campaign_id
`;

export function getMonthlyControlAssets(filters: MonthlyControlFilters): MonthlyControlRow[] {
  const db = getDb();
  const { where, params } = buildMonthlyControlWhere(filters);
  return db
    .prepare(`${MONTHLY_CONTROL_SQL} ${where} ORDER BY b.name, act.activity_label, a.asset_type LIMIT 2000`)
    .all(...params) as MonthlyControlRow[];
}

/** Distinct secondary-filter option lists, scoped to the month + primary filter
 *  only — so dropdowns narrow to what's actually in view, independent of which
 *  secondary filter is currently applied. */
export function getMonthlyControlFacets(monthId: string | undefined, primary: string | undefined): {
  brands: { id: string; name: string }[];
  activityTypes: string[];
  assetTypes: string[];
} {
  const db = getDb();
  const { where, params } = buildMonthlyControlWhere({ monthId, primary });
  const brands = db
    .prepare(`SELECT DISTINCT a.brand_id as id, b.name FROM design_assets a JOIN brands b ON b.id = a.brand_id LEFT JOIN design_activities act ON act.id = a.activity_id LEFT JOIN design_briefs br ON br.id = a.design_brief_id LEFT JOIN campaigns c ON c.id = a.campaign_id ${where} ORDER BY b.name`)
    .all(...params) as { id: string; name: string }[];
  const activityTypeWhere = where ? `${where} AND act.activity_type IS NOT NULL` : "WHERE act.activity_type IS NOT NULL";
  const activityTypes = (
    db
      .prepare(`SELECT DISTINCT act.activity_type as t FROM design_assets a LEFT JOIN brands b ON b.id = a.brand_id LEFT JOIN design_activities act ON act.id = a.activity_id LEFT JOIN design_briefs br ON br.id = a.design_brief_id LEFT JOIN campaigns c ON c.id = a.campaign_id ${activityTypeWhere} ORDER BY t`)
      .all(...params) as { t: string }[]
  ).map((r) => r.t);
  const assetTypes = (
    db
      .prepare(`SELECT DISTINCT a.asset_type as t FROM design_assets a LEFT JOIN brands b ON b.id = a.brand_id LEFT JOIN design_activities act ON act.id = a.activity_id LEFT JOIN design_briefs br ON br.id = a.design_brief_id LEFT JOIN campaigns c ON c.id = a.campaign_id ${where} ORDER BY t`)
      .all(...params) as { t: string }[]
  ).map((r) => r.t);
  return { brands, activityTypes, assetTypes };
}

export interface DesignAssetRow extends DesignAsset {
  brand_name: string | null;
  campaign_name_linked: string | null;
  brief_campaign_name: string | null;
  product_count: number;
  activity_type: string | null;
  activity_label: string | null;
  portfolio_name: string | null;
  month_label: string | null;
  category_name: string | null;
}

const ASSET_ROW_SQL = `
  SELECT a.*, b.name as brand_name, c.name as campaign_name_linked, br.campaign_name as brief_campaign_name,
         (SELECT COUNT(*) FROM design_asset_products p WHERE p.design_asset_id = a.id) as product_count,
         act.activity_type, act.activity_label, pf.name as portfolio_name, m.month_label, cat.name as category_name
  FROM design_assets a
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN campaigns c ON c.id = a.campaign_id
  LEFT JOIN design_briefs br ON br.id = a.design_brief_id
  LEFT JOIN design_activities act ON act.id = a.activity_id
  LEFT JOIN portfolios pf ON pf.id = act.portfolio_id
  LEFT JOIN months m ON m.id = a.month_id
  LEFT JOIN categories cat ON cat.id = a.category_id
`;

export interface DesignAssetFilters {
  channel?: string;
  brandId?: string;
  campaignId?: string;
  designBriefId?: string;
  needsMappingOnly?: boolean;
  auditState?: LeaderAuditState; // any audit field not yet at this state — used for "TO CHECK" queue
}

/** OUTPUT 2 — Design Asset Checklist. The primary operational table. */
export function listDesignAssets(filters: DesignAssetFilters = {}): DesignAssetRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.channel) { clauses.push("a.channel = ?"); params.push(filters.channel); }
  if (filters.brandId) { clauses.push("a.brand_id = ?"); params.push(filters.brandId); }
  if (filters.campaignId) { clauses.push("a.campaign_id = ?"); params.push(filters.campaignId); }
  if (filters.designBriefId) { clauses.push("a.design_brief_id = ?"); params.push(filters.designBriefId); }
  if (filters.needsMappingOnly) { clauses.push("a.confidence != 'HIGH'"); }
  if (filters.auditState === "TO CHECK") {
    clauses.push(
      `(a.brief_complete = 'TO CHECK' OR a.sku_complete = 'TO CHECK' OR a.promotion_verified = 'TO CHECK'
        OR a.timeline_verified = 'TO CHECK' OR a.content_verified = 'TO CHECK' OR a.branding_verified = 'TO CHECK'
        OR a.design_output_received = 'TO CHECK' OR a.final_output_audited = 'TO CHECK' OR a.ready_to_publish = 'TO CHECK')`
    );
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(`${ASSET_ROW_SQL} ${where} ORDER BY br.campaign_name, a.channel, a.asset_type LIMIT 1000`)
    .all(...params) as DesignAssetRow[];
}

export function getDesignAsset(id: string): DesignAssetRow | undefined {
  const db = getDb();
  return db.prepare(`${ASSET_ROW_SQL} WHERE a.id = ?`).get(id) as DesignAssetRow | undefined;
}

export interface DesignAssetProductRow {
  id: string;
  design_asset_id: string;
  product_code: string | null;
  product_name: string | null;
  product_group: string | null;
  role_note: string | null;
}

export function getDesignAssetProducts(assetId: string): DesignAssetProductRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM design_asset_products WHERE design_asset_id = ? ORDER BY product_name")
    .all(assetId) as DesignAssetProductRow[];
}

/** OUTPUT 3 — Product/SKU Mapping. One row per asset-product pair — the same
 *  design can list many products without duplicating the design task itself. */
export interface ProductMappingRow {
  asset_id: string;
  asset_type: string;
  variant_label: string | null;
  channel: string;
  brand_name: string | null;
  campaign_name: string | null;
  product_code: string | null;
  product_name: string | null;
  product_group: string | null;
  promotion_channel: string | null;
  promotion_mechanic: string | null;
}

export function listProductMapping(filters: { designBriefId?: string; campaignId?: string } = {}): ProductMappingRow[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.designBriefId) { clauses.push("a.design_brief_id = ?"); params.push(filters.designBriefId); }
  if (filters.campaignId) { clauses.push("a.campaign_id = ?"); params.push(filters.campaignId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return db
    .prepare(
      `SELECT a.id as asset_id, a.asset_type, a.variant_label, a.channel, b.name as brand_name,
              COALESCE(c.name, br.campaign_name) as campaign_name,
              p.product_code, p.product_name, p.product_group, a.promotion_channel, a.promotion_mechanic
       FROM design_asset_products p
       JOIN design_assets a ON a.id = p.design_asset_id
       LEFT JOIN brands b ON b.id = a.brand_id
       LEFT JOIN campaigns c ON c.id = a.campaign_id
       LEFT JOIN design_briefs br ON br.id = a.design_brief_id
       ${where}
       ORDER BY campaign_name, a.asset_type, p.product_name
       LIMIT 2000`
    )
    .all(...params) as ProductMappingRow[];
}

export interface DesignBriefRow extends DesignBrief {
  brand_name: string | null;
  campaign_name_linked: string | null;
}

export function listDesignBriefs(): DesignBriefRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT br.*, b.name as brand_name, c.name as campaign_name_linked
       FROM design_briefs br
       LEFT JOIN brands b ON b.id = br.brand_id
       LEFT JOIN campaigns c ON c.id = br.campaign_id
       ORDER BY br.status, br.campaign_name`
    )
    .all() as DesignBriefRow[];
}

/** OUTPUT 1 — Campaign Asset Summary. */
export interface CampaignAssetSummaryRow {
  design_brief_id: string;
  campaign_name: string | null;
  brand_name: string | null;
  period_start: string | null;
  period_end: string | null;
  design_deadline: string | null;
  total_assets: number;
  in_store: number;
  digital: number;
  demo: number;
  other: number;
  needs_mapping: number;
  status: string;
}

export function getCampaignAssetSummary(): CampaignAssetSummaryRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT br.id as design_brief_id, br.campaign_name, b.name as brand_name, br.period_start, br.period_end,
              br.design_deadline, br.status,
              COUNT(a.id) as total_assets,
              SUM(CASE WHEN a.channel = 'IN-STORE' THEN 1 ELSE 0 END) as in_store,
              SUM(CASE WHEN a.channel IN ('DIGITAL','WEBSITE','SOCIAL','EMAIL') THEN 1 ELSE 0 END) as digital,
              SUM(CASE WHEN a.channel = 'DEMO' THEN 1 ELSE 0 END) as demo,
              SUM(CASE WHEN a.channel NOT IN ('IN-STORE','DIGITAL','WEBSITE','SOCIAL','EMAIL','DEMO') THEN 1 ELSE 0 END) as other,
              SUM(CASE WHEN a.confidence != 'HIGH' THEN 1 ELSE 0 END) as needs_mapping
       FROM design_briefs br
       LEFT JOIN brands b ON b.id = br.brand_id
       LEFT JOIN design_assets a ON a.design_brief_id = br.id
       WHERE br.status = 'IMPORTED'
       GROUP BY br.id
       ORDER BY br.campaign_name`
    )
    .all() as CampaignAssetSummaryRow[];
}

/** OUTPUT 4 — Campaign Asset Matrix. Rows = campaign/brief, columns = asset type,
 *  cell = required (✓) / not required (—). Never infers "required" from another
 *  campaign's usage — only what THIS brief's assets actually contain. */
export function getCampaignAssetMatrix(): { rows: { design_brief_id: string; campaign_name: string | null; assetTypes: string[] }[]; columns: string[] } {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.design_brief_id, br.campaign_name, a.asset_type
       FROM design_assets a
       JOIN design_briefs br ON br.id = a.design_brief_id
       WHERE br.status = 'IMPORTED'
       ORDER BY br.campaign_name`
    )
    .all() as { design_brief_id: string; campaign_name: string | null; asset_type: string }[];

  const byBrief = new Map<string, { campaign_name: string | null; assetTypes: Set<string> }>();
  const allTypes = new Set<string>();
  for (const r of rows) {
    if (!byBrief.has(r.design_brief_id)) byBrief.set(r.design_brief_id, { campaign_name: r.campaign_name, assetTypes: new Set() });
    byBrief.get(r.design_brief_id)!.assetTypes.add(r.asset_type);
    allTypes.add(r.asset_type);
  }

  return {
    rows: [...byBrief.entries()].map(([design_brief_id, v]) => ({ design_brief_id, campaign_name: v.campaign_name, assetTypes: [...v.assetTypes] })),
    columns: [...allTypes].sort(),
  };
}

export interface DesignAssetQuickCounts {
  total: number;
  toCheck: number;
  needsMapping: number;
  promotionConflicts: number;
}

export function getDesignAssetQuickCounts(): DesignAssetQuickCounts {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) c FROM design_assets").get() as { c: number }).c;
  const toCheck = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM design_assets WHERE
         brief_complete = 'TO CHECK' OR sku_complete = 'TO CHECK' OR promotion_verified = 'TO CHECK'
         OR timeline_verified = 'TO CHECK' OR content_verified = 'TO CHECK' OR branding_verified = 'TO CHECK'
         OR design_output_received = 'TO CHECK' OR final_output_audited = 'TO CHECK' OR ready_to_publish = 'TO CHECK'`
      )
      .get() as { c: number }
  ).c;
  const needsMapping = (db.prepare("SELECT COUNT(*) c FROM design_assets WHERE confidence != 'HIGH'").get() as { c: number }).c;
  const promotionConflicts = (db.prepare("SELECT COUNT(*) c FROM design_assets WHERE promotion_conflict = 1").get() as { c: number }).c;
  return { total, toCheck, needsMapping, promotionConflicts };
}

export const AUDIT_FIELDS = [
  "brief_complete", "sku_complete", "promotion_verified", "timeline_verified",
  "content_verified", "branding_verified", "design_output_received", "final_output_audited", "ready_to_publish",
] as const;
export type AuditField = (typeof AUDIT_FIELDS)[number];

export function updateDesignAssetAudit(id: string, field: AuditField, value: LeaderAuditState): void {
  const db = getDb();
  if (!AUDIT_FIELDS.includes(field)) throw new Error(`Unknown audit field: ${field}`);
  db.prepare(`UPDATE design_assets SET ${field} = ?, last_updated = datetime('now') WHERE id = ?`).run(value, id);
}

export function updateDesignAssetEvidenceLink(id: string, link: string | null): void {
  const db = getDb();
  db.prepare("UPDATE design_assets SET evidence_link = ?, last_updated = datetime('now') WHERE id = ?").run(link, id);
}

// ── Brand aggregation — Design Activities grouped, never duplicated ────────

export interface BrandDesignActivityRow {
  activity_id: string;
  activity_type: string;
  activity_label: string;
  month_label: string | null;
  asset_count: number;
  product_count: number;
  promotion_mechanic: string | null;
}

/** All Design Activities for a Brand, across months — the same underlying
 *  Activity/Asset records shown in Design Assets, grouped here by type for the
 *  Brand 360 view. Never a separate copy of the data. */
export function getBrandDesignActivities(brandId: string): BrandDesignActivityRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT act.id as activity_id, act.activity_type, act.activity_label, m.month_label,
              COUNT(DISTINCT a.id) as asset_count,
              COUNT(DISTINCT p.id) as product_count,
              act.promotion_mechanic
       FROM design_activities act
       LEFT JOIN design_assets a ON a.activity_id = act.id
       LEFT JOIN design_asset_products p ON p.design_asset_id = a.id
       LEFT JOIN months m ON m.id = act.month_id
       WHERE act.brand_id = ?
       GROUP BY act.id
       ORDER BY m.year, m.month_number, act.activity_type, act.activity_label`
    )
    .all(brandId) as BrandDesignActivityRow[];
}
