import { getDb } from "../db/client";
import { refreshRisk } from "../db/repo";
import { currentWeekCode } from "../db/weeks";
import type { ControlTaskView } from "../db/types";

export interface ControlSummary {
  needReview: number;
  overdue: number;
  atRisk: number;
  blocked: number;
  externalDue: number;
}

const TASK_VIEW_SQL = `
  SELECT ct.*, d.workstream as deliverable_workstream, d.subtype as deliverable_subtype,
         d.pic_role as deliverable_pic_role, d.sku_name as deliverable_sku_name,
         c.id as campaign_id, c.name as campaign_name, c.campaign_type,
         b.name as brand_name
  FROM control_tasks ct
  JOIN deliverables d ON d.id = ct.deliverable_id
  LEFT JOIN campaigns c ON c.id = d.campaign_id
  LEFT JOIN brands b ON b.id = d.brand_id
`;

export function ensureFreshData(): void {
  const db = getDb();
  refreshRisk(db);
}

export function getControlSummary(): ControlSummary {
  const db = getDb();
  ensureFreshData();
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date();
  in14.setDate(in14.getDate() + 14);
  const in14Iso = in14.toISOString().slice(0, 10);

  const needReview = (
    db
      .prepare(`SELECT COUNT(*) c FROM control_tasks WHERE status = 'WAITING FOR LEADER REVIEW'`)
      .get() as { c: number }
  ).c;
  const overdue = (
    db.prepare(`SELECT COUNT(*) c FROM control_tasks WHERE risk_level = 'RED'`).get() as { c: number }
  ).c;
  const atRisk = (
    db.prepare(`SELECT COUNT(*) c FROM control_tasks WHERE risk_level = 'AMBER'`).get() as { c: number }
  ).c;
  const blocked = (
    db.prepare(`SELECT COUNT(*) c FROM control_tasks WHERE status = 'BLOCKED'`).get() as { c: number }
  ).c;
  const externalDue = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM control_tasks
         WHERE external_commitment = 1 AND external_deadline IS NOT NULL
           AND external_deadline BETWEEN ? AND ?
           AND (external_delivery_status IS NULL OR external_delivery_status != 'DELIVERED')`
      )
      .get(today, in14Iso) as { c: number }
  ).c;

  return { needReview, overdue, atRisk, blocked, externalDue };
}

export interface SupplyUpdateRow {
  id: string;
  supplier: string | null;
  container_no: string | null;
  product_label: string | null;
  eta: string;
  status: string | null;
}

/** Upcoming supply signals (containers/stock) — next 21 days from today, earliest first. */
export function getSupplyUpdates(limit = 6): SupplyUpdateRow[] {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const in21 = new Date();
  in21.setDate(in21.getDate() + 21);
  return db
    .prepare(
      `SELECT id, supplier, container_no, product_label, eta, status FROM supply_signals
       WHERE eta BETWEEN ? AND ? ORDER BY eta LIMIT ?`
    )
    .all(today, in21.toISOString().slice(0, 10), limit) as SupplyUpdateRow[];
}

export type Bucket = "needReview" | "overdue" | "atRisk" | "blocked" | "externalDue" | "today" | "thisWeek" | "next2Weeks";

export function getTasksByBucket(bucket: Bucket): ControlTaskView[] {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in21 = new Date();
  in21.setDate(in21.getDate() + 21);

  let where = "";
  const params: unknown[] = [];

  switch (bucket) {
    case "needReview":
      where = `ct.status = 'WAITING FOR LEADER REVIEW'`;
      break;
    case "overdue":
      where = `ct.risk_level = 'RED'`;
      break;
    case "atRisk":
      where = `ct.risk_level = 'AMBER'`;
      break;
    case "blocked":
      where = `ct.status = 'BLOCKED'`;
      break;
    case "externalDue":
      where = `ct.external_commitment = 1 AND ct.external_deadline BETWEEN ? AND ? AND (ct.external_delivery_status IS NULL OR ct.external_delivery_status != 'DELIVERED')`;
      params.push(today, in21.toISOString().slice(0, 10));
      break;
    case "today":
      where = `ct.control_date = ? AND ct.status NOT IN ('CLOSED','APPROVED','DELIVERED')`;
      params.push(today);
      break;
    case "thisWeek":
      where = `ct.week_code = ? AND ct.status NOT IN ('CLOSED','APPROVED','DELIVERED')`;
      params.push(currentWeekCode());
      break;
    case "next2Weeks":
      where = `ct.control_date BETWEEN ? AND ? AND ct.status NOT IN ('CLOSED','APPROVED','DELIVERED')`;
      params.push(today, in7.toISOString().slice(0, 10));
      break;
  }

  const rows = db
    .prepare(
      `${TASK_VIEW_SQL} WHERE ${where}
       ORDER BY CASE ct.risk_level WHEN 'RED' THEN 0 WHEN 'AMBER' THEN 1 ELSE 2 END,
                ct.control_date IS NULL, ct.control_date ASC
       LIMIT 200`
    )
    .all(...params) as ControlTaskView[];
  return rows;
}
