import { getDb } from "../db/client";

export interface InStoreWeekSummary {
  demoSessions: number;
  demoAtRisk: number;
  posmDue: number;
  tvcChanges: number;
  evidenceMissing: number;
  needMyReview: number;
}

/** POSM/TVC counts are 0 by design — POSM26/TVC26 aren't present in the current
 *  source file (see Import → Data Health). Never fabricated. */
export function getInStoreWeekSummary(weekCode: string): InStoreWeekSummary {
  const db = getDb();
  const demoSessions = (
    db.prepare(`SELECT COUNT(*) c FROM deliverables WHERE subtype = 'Demo' AND week_code = ?`).get(weekCode) as { c: number }
  ).c;
  const demoAtRisk = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM control_tasks ct JOIN deliverables d ON d.id = ct.deliverable_id
         WHERE d.subtype = 'Demo' AND d.week_code = ? AND ct.risk_level IN ('RED','AMBER')`
      )
      .get(weekCode) as { c: number }
  ).c;
  const evidenceMissing = (
    db
      .prepare(`SELECT COUNT(*) c FROM deliverables WHERE subtype = 'Demo' AND week_code = ? AND evidence_status = 'PENDING'`)
      .get(weekCode) as { c: number }
  ).c;
  const needMyReview = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM control_tasks ct JOIN deliverables d ON d.id = ct.deliverable_id
         WHERE d.workstream = 'Retail/In-store' AND ct.week_code = ? AND ct.status = 'WAITING FOR LEADER REVIEW'`
      )
      .get(weekCode) as { c: number }
  ).c;

  return { demoSessions, demoAtRisk, posmDue: 0, tvcChanges: 0, evidenceMissing, needMyReview };
}

export interface InStoreDemoRow {
  id: string;
  brand_name: string | null;
  sku_name: string | null;
  location: string | null;
  session_label: string | null;
  status: string;
  risk_level: string;
  week_code: string | null;
}

export function getInStoreWeekDemo(weekCode: string): InStoreDemoRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT d.id, b.name as brand_name, d.sku_name, d.location, d.session_label, d.status, d.week_code,
              COALESCE(ct.risk_level, 'GREEN') as risk_level
       FROM deliverables d
       LEFT JOIN brands b ON b.id = d.brand_id
       LEFT JOIN control_tasks ct ON ct.deliverable_id = d.id
       WHERE d.subtype = 'Demo' AND d.week_code = ?
       ORDER BY d.location`
    )
    .all(weekCode) as InStoreDemoRow[];
}

/** Weekday operational rhythm — reference cadence, not live data (see conversation spec). */
export const IN_STORE_WEEKDAY_RULES: { day: string; items: string[] }[] = [
  { day: "MON", items: ["Previous-week POSM display review", "Current-week demo readiness review", "Demo evidence due"] },
  { day: "TUE", items: ["Audit TVC requests", "Audit design briefs", "POSM display audit"] },
  { day: "WED", items: ["Verify TVC setup", "Verify UK channel publication", "POSM fee request/approval", "Agency booking check"] },
  { day: "THU", items: ["Review POSM audit", "POSM guideline check", "Verify POSM packing/dispatch"] },
  { day: "FRI", items: ["Review demo guideline", "Review upcoming demo plan", "Audit TVC/POSM evidence"] },
];
