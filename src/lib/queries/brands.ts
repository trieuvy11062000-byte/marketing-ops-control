import { getDb } from "../db/client";

export interface BrandListItem {
  id: string;
  name: string;
  demoSessions: number;
  outstandingControls: number;
  atRisk: number;
  apPackages: number;
}

/** Every brand, unfiltered — for pickers (e.g. Quick Task "Related Brand"), not the Brand list page. */
export function listAllBrandsLite(): { id: string; name: string }[] {
  const db = getDb();
  return db.prepare("SELECT id, name FROM brands ORDER BY name").all() as { id: string; name: string }[];
}

export function listBrands(): BrandListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT b.id, b.name,
              COUNT(DISTINCT d.id) as demoSessions,
              COUNT(DISTINCT CASE WHEN ct.status NOT IN ('CLOSED','APPROVED','DELIVERED') THEN ct.id END) as outstandingControls,
              COUNT(DISTINCT CASE WHEN ct.risk_level IN ('RED','AMBER') THEN ct.id END) as atRisk,
              (SELECT COUNT(*) FROM ap_packages WHERE brand_id = b.id) as apPackages
       FROM brands b
       LEFT JOIN deliverables d ON d.brand_id = b.id
       LEFT JOIN control_tasks ct ON ct.deliverable_id = d.id
       GROUP BY b.id, b.name
       HAVING demoSessions > 0 OR apPackages > 0
       ORDER BY atRisk DESC, outstandingControls DESC, b.name`
    )
    .all() as BrandListItem[];
}

export function getBrand(id: string): { id: string; name: string } | undefined {
  const db = getDb();
  return db.prepare("SELECT id, name FROM brands WHERE id = ?").get(id) as { id: string; name: string } | undefined;
}

export interface BrandCampaignRow {
  id: string;
  name: string;
  campaign_type: string | null;
}

/** Campaigns directly attributed to this brand. Most LGD campaigns (Monthly,
 *  Clearance, storewide Golden Week) span every brand and won't appear here — that's
 *  correct, not a bug: Campaign.brand_id is only set when the source data actually
 *  ties a campaign to one brand. */
export function getBrandCampaigns(brandId: string): BrandCampaignRow[] {
  const db = getDb();
  return db
    .prepare("SELECT id, name, campaign_type FROM campaigns WHERE brand_id = ? ORDER BY start_date DESC LIMIT 30")
    .all(brandId) as BrandCampaignRow[];
}

export interface BrandDemoRow {
  week_code: string | null;
  location: string | null;
  session_label: string | null;
  sku_name: string | null;
  status: string;
}

export function getBrandDemoSessions(brandId: string): BrandDemoRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT week_code, location, session_label, sku_name, status FROM deliverables
       WHERE brand_id = ? AND subtype = 'Demo' ORDER BY week_code, location`
    )
    .all(brandId) as BrandDemoRow[];
}

export interface BrandApPackageRow {
  id: string;
  name: string;
  status: string;
  line_count: number;
  reported_count: number;
}

export function getBrandApPackages(brandId: string): BrandApPackageRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.id, p.name, p.status,
              COUNT(l.id) as line_count,
              SUM(CASE WHEN l.reported = 1 THEN 1 ELSE 0 END) as reported_count
       FROM ap_packages p LEFT JOIN ap_delivery_lines l ON l.package_id = p.id
       WHERE p.brand_id = ? GROUP BY p.id`
    )
    .all(brandId) as BrandApPackageRow[];
}

export function getBrandPromotionCount(brandId: string): number {
  const db = getDb();
  return (db.prepare("SELECT COUNT(*) c FROM promotions WHERE brand_id = ?").get(brandId) as { c: number }).c;
}
