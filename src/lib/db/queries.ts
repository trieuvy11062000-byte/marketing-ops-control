import { getDb } from "./client";
import { refreshRisk } from "./repo";
import { generateWeeks2026, type WeekRow } from "./weeks";
import type { ControlStatus, LeaderAction, PicRole, RiskLevel, Workstream } from "./types";

export interface ControlItem {
  id: string;
  leaderAction: LeaderAction;
  title: string;
  controlDate: string | null;
  weekCode: string | null;
  status: ControlStatus;
  riskLevel: RiskLevel;
  riskReason: string | null;
  nextAction: string | null;
  issueBlocker: string | null;
  externalCommitment: boolean;
  externalDeadline: string | null;
  externalDeliveryStatus: string | null;

  workstream: Workstream;
  subtype: string;
  picRole: PicRole | null;
  skuName: string | null;
  executionDate: string | null;
  executionDeadline: string | null;
  evidenceRequired: boolean;
  evidenceStatus: string | null;

  campaignId: string;
  campaignName: string;
  campaignType: string | null;

  brandId: string | null;
  brandName: string | null;
}

export interface DeliverableRollup {
  workstream: Workstream;
  subtype: string;
  count: number;
  statusCounts: Record<string, number>;
  picRole: PicRole | null;
  controlItemId: string | null;
}

export interface CampaignSummary {
  id: string;
  name: string;
  campaignType: string | null;
  weekStart: string | null;
  weekEnd: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ControlStatus;
  deliverableCount: number;
  brandIds: string[];
  brandNames: string[];
  controlItemIds: string[];
  rollups: DeliverableRollup[];
}

export interface BrandSummary {
  id: string;
  name: string;
  campaignIds: string[];
  controlItemIds: string[];
  outstanding: number;
  atRisk: number;
  overdue: number;
}

export interface MasterPayload {
  weeks: WeekRow[];
  items: ControlItem[];
  campaigns: CampaignSummary[];
  brands: BrandSummary[];
  todayWeekCode: string;
}

const OPEN_STATUSES = new Set<ControlStatus>([
  "NOT STARTED",
  "IN PROGRESS",
  "WAITING FOR OUTPUT",
  "WAITING FOR LEADER REVIEW",
  "CHANGES REQUIRED",
  "BLOCKED",
  "LIVE",
  "EVIDENCE PENDING",
]);

function weekCodeForDate(isoDate: string): string {
  const start = new Date(Date.UTC(2026, 0, 2));
  const d = new Date(isoDate + "T00:00:00Z");
  const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const n = Math.max(1, Math.min(52, Math.floor(diffDays / 7) + 1));
  return `W${String(n).padStart(2, "0")}`;
}

export function getMasterPayload(): MasterPayload {
  const db = getDb();
  refreshRisk(db);

  const weeks = generateWeeks2026();
  const weekByCode = new Map(weeks.map((w) => [w.week_code, w]));
  const todayWeekCode = weekCodeForDate(new Date().toISOString().slice(0, 10));

  const rows = db
    .prepare(
      `SELECT
        ct.id, ct.leader_action, ct.title, ct.control_date, ct.week_code, ct.status,
        ct.risk_level, ct.risk_reason, ct.next_action, ct.issue_blocker,
        ct.external_commitment, ct.external_deadline, ct.external_delivery_status,
        d.workstream, d.subtype, d.pic_role, d.sku_name, d.execution_date, d.execution_deadline,
        d.evidence_required, d.evidence_status,
        c.id as campaign_id, c.name as campaign_name, c.campaign_type,
        b.id as brand_id, b.name as brand_name
      FROM control_tasks ct
      JOIN deliverables d ON d.id = ct.deliverable_id
      JOIN campaigns c ON c.id = d.campaign_id
      LEFT JOIN brands b ON b.id = d.brand_id
      ORDER BY ct.control_date ASC`
    )
    .all() as Array<{
    id: string;
    leader_action: LeaderAction;
    title: string;
    control_date: string | null;
    week_code: string | null;
    status: ControlStatus;
    risk_level: RiskLevel;
    risk_reason: string | null;
    next_action: string | null;
    issue_blocker: string | null;
    external_commitment: number;
    external_deadline: string | null;
    external_delivery_status: string | null;
    workstream: Workstream;
    subtype: string;
    pic_role: PicRole | null;
    sku_name: string | null;
    execution_date: string | null;
    execution_deadline: string | null;
    evidence_required: number;
    evidence_status: string | null;
    campaign_id: string;
    campaign_name: string;
    campaign_type: string | null;
    brand_id: string | null;
    brand_name: string | null;
  }>;

  const items: ControlItem[] = rows.map((r) => ({
    id: r.id,
    leaderAction: r.leader_action,
    title: r.title,
    controlDate: r.control_date,
    weekCode: r.week_code,
    status: r.status,
    riskLevel: r.risk_level,
    riskReason: r.risk_reason,
    nextAction: r.next_action,
    issueBlocker: r.issue_blocker,
    externalCommitment: !!r.external_commitment,
    externalDeadline: r.external_deadline,
    externalDeliveryStatus: r.external_delivery_status,
    workstream: r.workstream,
    subtype: r.subtype,
    picRole: r.pic_role,
    skuName: r.sku_name,
    executionDate: r.execution_date,
    executionDeadline: r.execution_deadline,
    evidenceRequired: !!r.evidence_required,
    evidenceStatus: r.evidence_status,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    campaignType: r.campaign_type,
    brandId: r.brand_id,
    brandName: r.brand_name,
  }));

  const itemsByCampaign = new Map<string, ControlItem[]>();
  for (const it of items) {
    const arr = itemsByCampaign.get(it.campaignId) ?? [];
    arr.push(it);
    itemsByCampaign.set(it.campaignId, arr);
  }

  const campaignRows = db.prepare(`SELECT * FROM campaigns`).all() as Array<{
    id: string;
    name: string;
    campaign_type: string | null;
    week_start: string | null;
    week_end: string | null;
    status: ControlStatus;
  }>;

  const deliverableRollupRows = db
    .prepare(
      `SELECT
        d.campaign_id, d.workstream, d.subtype, d.pic_role, d.status, d.brand_id, b.name as brand_name,
        COUNT(*) as c
      FROM deliverables d
      LEFT JOIN brands b ON b.id = d.brand_id
      GROUP BY d.campaign_id, d.workstream, d.subtype, d.pic_role, d.status, d.brand_id`
    )
    .all() as Array<{
    campaign_id: string;
    workstream: Workstream;
    subtype: string;
    pic_role: PicRole | null;
    status: ControlStatus;
    brand_id: string | null;
    brand_name: string | null;
    c: number;
  }>;

  const deliverableCountByCampaign = new Map<string, number>();
  const brandsByCampaign = new Map<string, Map<string, string>>();
  const rollupsByCampaign = new Map<string, Map<string, DeliverableRollup>>();

  for (const r of deliverableRollupRows) {
    deliverableCountByCampaign.set(r.campaign_id, (deliverableCountByCampaign.get(r.campaign_id) ?? 0) + r.c);

    if (r.brand_id && r.brand_name) {
      const m = brandsByCampaign.get(r.campaign_id) ?? new Map<string, string>();
      m.set(r.brand_id, r.brand_name);
      brandsByCampaign.set(r.campaign_id, m);
    }

    const key = `${r.workstream}::${r.subtype}`;
    const cmap = rollupsByCampaign.get(r.campaign_id) ?? new Map<string, DeliverableRollup>();
    const existing = cmap.get(key);
    if (existing) {
      existing.count += r.c;
      existing.statusCounts[r.status] = (existing.statusCounts[r.status] ?? 0) + r.c;
    } else {
      cmap.set(key, {
        workstream: r.workstream,
        subtype: r.subtype,
        count: r.c,
        statusCounts: { [r.status]: r.c },
        picRole: r.pic_role,
        controlItemId: null,
      });
    }
    rollupsByCampaign.set(r.campaign_id, cmap);
  }

  const campaigns: CampaignSummary[] = campaignRows.map((c) => {
    const week = c.week_start ? weekByCode.get(c.week_start) : undefined;
    const brandMap = brandsByCampaign.get(c.id) ?? new Map();
    const rollupMap = rollupsByCampaign.get(c.id) ?? new Map();
    const campaignItems = itemsByCampaign.get(c.id) ?? [];

    for (const it of campaignItems) {
      const key = `${it.workstream}::${it.subtype}`;
      const r = rollupMap.get(key);
      if (r) r.controlItemId = it.id;
    }

    return {
      id: c.id,
      name: c.name,
      campaignType: c.campaign_type,
      weekStart: c.week_start,
      weekEnd: c.week_end,
      startDate: week?.start_date ?? null,
      endDate: week?.end_date ?? null,
      status: c.status,
      deliverableCount: deliverableCountByCampaign.get(c.id) ?? 0,
      brandIds: [...brandMap.keys()],
      brandNames: [...brandMap.values()],
      controlItemIds: campaignItems.map((i) => i.id),
      rollups: [...rollupMap.values()].sort((a, b) => b.count - a.count),
    };
  });

  const brandRows = db.prepare(`SELECT id, name FROM brands`).all() as Array<{ id: string; name: string }>;
  const itemsByBrand = new Map<string, ControlItem[]>();
  for (const it of items) {
    if (!it.brandId) continue;
    const arr = itemsByBrand.get(it.brandId) ?? [];
    arr.push(it);
    itemsByBrand.set(it.brandId, arr);
  }
  const campaignIdsByBrand = new Map<string, Set<string>>();
  for (const c of campaigns) {
    for (const bid of c.brandIds) {
      const s = campaignIdsByBrand.get(bid) ?? new Set<string>();
      s.add(c.id);
      campaignIdsByBrand.set(bid, s);
    }
  }

  const brands: BrandSummary[] = brandRows
    .map((b) => {
      const brandItems = itemsByBrand.get(b.id) ?? [];
      return {
        id: b.id,
        name: b.name,
        campaignIds: [...(campaignIdsByBrand.get(b.id) ?? [])],
        controlItemIds: brandItems.map((i) => i.id),
        outstanding: brandItems.filter((i) => OPEN_STATUSES.has(i.status)).length,
        atRisk: brandItems.filter((i) => i.riskLevel === "RED" || i.riskLevel === "AMBER").length,
        overdue: brandItems.filter((i) => i.riskLevel === "RED").length,
      };
    })
    .filter((b) => b.controlItemIds.length > 0 || b.campaignIds.length > 0);

  return { weeks, items, campaigns, brands, todayWeekCode };
}
