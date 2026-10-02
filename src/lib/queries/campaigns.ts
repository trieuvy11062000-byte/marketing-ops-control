import { getDb } from "../db/client";
import { computeCampaignStatus, type CampaignStatus } from "../db/status";
import type { Campaign, ControlTaskView, Promotion } from "../db/types";

export interface CampaignWithStatus extends Campaign {
  status: CampaignStatus;
  brand_name: string | null;
}

export function getCampaign(id: string): CampaignWithStatus | undefined {
  const db = getDb();
  const row = db
    .prepare(`SELECT c.*, b.name as brand_name FROM campaigns c LEFT JOIN brands b ON b.id = c.brand_id WHERE c.id = ?`)
    .get(id) as (Campaign & { brand_name: string | null }) | undefined;
  if (!row) return undefined;
  return { ...row, status: computeCampaignStatus(row.start_date, row.end_date, row.status_override) };
}

/** Lightweight list for pickers (e.g. Quick Task "Related Activation"). */
export function listCampaignsLite(): { id: string; name: string }[] {
  const db = getDb();
  return db.prepare("SELECT id, name FROM campaigns ORDER BY name").all() as { id: string; name: string }[];
}

export function listCampaigns(): CampaignWithStatus[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT c.*, b.name as brand_name FROM campaigns c LEFT JOIN brands b ON b.id = c.brand_id ORDER BY c.start_date DESC`)
    .all() as (Campaign & { brand_name: string | null })[];
  return rows.map((row) => ({ ...row, status: computeCampaignStatus(row.start_date, row.end_date, row.status_override) }));
}

/** Deliverable execution progress for a campaign (Demo/POSM/TVC/Digital only — not promotions, not A&P). */
export function getCampaignProgress(campaignId: string): { total: number; done: number } {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status IN ('DELIVERED','CLOSED','APPROVED') THEN 1 ELSE 0 END) as done
       FROM deliverables WHERE campaign_id = ?`
    )
    .get(campaignId) as { total: number; done: number };
  return { total: row.total ?? 0, done: row.done ?? 0 };
}

export function getCampaignTasks(campaignId: string): ControlTaskView[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT ct.*, d.workstream as deliverable_workstream, d.subtype as deliverable_subtype,
              d.pic_role as deliverable_pic_role, d.sku_name as deliverable_sku_name,
              c.id as campaign_id, c.name as campaign_name, c.campaign_type,
              b.name as brand_name
       FROM control_tasks ct
       JOIN deliverables d ON d.id = ct.deliverable_id
       LEFT JOIN campaigns c ON c.id = d.campaign_id
       LEFT JOIN brands b ON b.id = d.brand_id
       WHERE d.campaign_id = ?
       ORDER BY CASE ct.risk_level WHEN 'RED' THEN 0 WHEN 'AMBER' THEN 1 ELSE 2 END, ct.control_date`
    )
    .all(campaignId) as ControlTaskView[];
}

export interface DeliverableRow {
  sku_code: string | null;
  sku_name: string | null;
  subtype: string;
  status: string;
  pic_role: string | null;
  execution_date: string | null;
  evidence_status: string | null;
  source_sheet: string;
}

export function getCampaignDeliverables(campaignId: string): DeliverableRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT sku_code, sku_name, subtype, status, pic_role, execution_date, evidence_status, source_sheet
       FROM deliverables WHERE campaign_id = ? ORDER BY subtype, sku_name LIMIT 500`
    )
    .all(campaignId) as DeliverableRow[];
}

export function getCampaignPromotions(campaignId: string): Promotion[] {
  const db = getDb();
  return db.prepare("SELECT * FROM promotions WHERE campaign_id = ? ORDER BY channel, sku_name LIMIT 500").all(campaignId) as Promotion[];
}

export interface CampaignPromotionSummary {
  channel: string;
  count: number;
}

export function getCampaignPromotionSummary(campaignId: string): CampaignPromotionSummary[] {
  const db = getDb();
  return db
    .prepare("SELECT channel, COUNT(*) as count FROM promotions WHERE campaign_id = ? GROUP BY channel")
    .all(campaignId) as CampaignPromotionSummary[];
}

export interface CampaignDigitalSummary {
  subtype: string;
  count: number;
}

export function getCampaignDigitalSummary(campaignId: string): CampaignDigitalSummary[] {
  const db = getDb();
  return db
    .prepare("SELECT subtype, COUNT(*) as count FROM digital_activities WHERE campaign_id = ? GROUP BY subtype")
    .all(campaignId) as CampaignDigitalSummary[];
}

/** Campaigns overlapping a given month (start_date <= monthEnd AND end_date >= monthStart). */
export function listCampaignsForMonth(year: number, month: number): CampaignWithStatus[] {
  const db = getDb();
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const rows = db
    .prepare(
      `SELECT c.*, b.name as brand_name FROM campaigns c LEFT JOIN brands b ON b.id = c.brand_id
       WHERE c.start_date <= ? AND c.end_date >= ?
       ORDER BY c.start_date`
    )
    .all(monthEnd, monthStart) as (Campaign & { brand_name: string | null })[];
  return rows.map((row) => ({ ...row, status: computeCampaignStatus(row.start_date, row.end_date, row.status_override) }));
}

/** A&P package(s) connected to this campaign's brand — Campaign links out, never duplicates A&P data. */
export function getCampaignApPackages(brandId: string | null): { id: string; name: string; status: string }[] {
  if (!brandId) return [];
  const db = getDb();
  return db.prepare("SELECT id, name, status FROM ap_packages WHERE brand_id = ?").all(brandId) as {
    id: string;
    name: string;
    status: string;
  }[];
}
