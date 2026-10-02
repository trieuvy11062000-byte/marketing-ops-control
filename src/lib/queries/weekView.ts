import { getDb } from "../db/client";
import { computePromotionStatus, daysRemaining } from "../db/status";
import type { ControlTaskView, Workstream } from "../db/types";
import type { PromotionWithStatus } from "./promotions";

const TASK_VIEW_SQL = `
  SELECT ct.*, d.workstream as deliverable_workstream, d.subtype as deliverable_subtype,
         d.pic_role as deliverable_pic_role, d.sku_name as deliverable_sku_name,
         c.id as campaign_id, c.name as campaign_name, c.campaign_type,
         b.name as brand_name
  FROM control_tasks ct
  JOIN deliverables d ON d.id = ct.deliverable_id
  LEFT JOIN campaigns c ON c.id = d.campaign_id
  LEFT JOIN brands b ON b.id = d.brand_id
  WHERE ct.week_code = ?
  ORDER BY CASE ct.risk_level WHEN 'RED' THEN 0 WHEN 'AMBER' THEN 1 ELSE 2 END, ct.control_date
`;

export interface WeekSummary {
  needReview: number;
  overdue: number;
  atRisk: number;
  blocked: number;
}

export function getWeekTasks(weekCode: string): ControlTaskView[] {
  const db = getDb();
  return db.prepare(TASK_VIEW_SQL).all(weekCode) as ControlTaskView[];
}

/** Deliverable-backed workstreams only (Retail/In-store, Digital, A&P, Project/Management).
 *  Promotions are a separate module — see getWeekPromotions(). */
export function getWeekTasksByWorkstream(weekCode: string): Record<Workstream, ControlTaskView[]> {
  const tasks = getWeekTasks(weekCode);
  const groups: Record<string, ControlTaskView[]> = {
    "Retail/In-store": [],
    Digital: [],
    "A&P": [],
    "Project/Management": [],
  };
  for (const t of tasks) {
    (groups[t.deliverable_workstream] ??= []).push(t);
  }
  return groups as Record<Workstream, ControlTaskView[]>;
}

export function getWeekPromotions(weekCode: string): PromotionWithStatus[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, b.name as brand_name, c.name as campaign_name
       FROM promotions p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN campaigns c ON c.id = p.campaign_id
       WHERE p.week_code = ? ORDER BY p.channel, p.sku_name LIMIT 300`
    )
    .all(weekCode) as (PromotionWithStatus & { brand_name: string | null; campaign_name: string | null })[];

  return rows.map((row) => ({
    ...row,
    status: computePromotionStatus(row.start_date, row.end_date, row.status_override),
    days_remaining: daysRemaining(row.end_date),
  }));
}

export function getWeekSummary(weekCode: string): WeekSummary {
  const tasks = getWeekTasks(weekCode);
  return {
    needReview: tasks.filter((t) => t.status === "WAITING FOR LEADER REVIEW").length,
    overdue: tasks.filter((t) => t.risk_level === "RED").length,
    atRisk: tasks.filter((t) => t.risk_level === "AMBER").length,
    blocked: tasks.filter((t) => t.status === "BLOCKED").length,
  };
}
