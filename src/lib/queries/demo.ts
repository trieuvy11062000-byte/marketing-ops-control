import { getDb } from "../db/client";

export interface DemoCommitmentSummary {
  brand_id: string;
  brand_name: string;
  agreed_quantity: number;
  executed_quantity: number;
  unit: string;
  reasons: string | null;
  period_label: string;
}

/** Demo session commitments now live as A&P delivery lines (Tasting) — see [[apDemoDelivery.ts]].
 *  This reads that same reconciliation data for the Demo Events page. */
export function getDemoCommitmentSummary(): DemoCommitmentSummary[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT l.link_brand_id as brand_id, b.name as brand_name,
              l.agreed_quantity as agreed_quantity,
              COALESCE(l.delivered_quantity, 0) as executed_quantity,
              'sessions' as unit,
              l.source_row_ref as reasons,
              p.period_start || ' – ' || p.period_end as period_label
       FROM ap_delivery_lines l
       JOIN ap_packages p ON p.id = l.package_id
       JOIN brands b ON b.id = l.link_brand_id
       WHERE l.deliverable_type = 'Tasting' AND l.link_subtype = 'Demo'
       ORDER BY agreed_quantity DESC`
    )
    .all() as DemoCommitmentSummary[];
}

export interface DemoSessionRow {
  id: string;
  brand_name: string | null;
  location: string | null;
  session_label: string | null;
  sku_name: string | null;
  week_code: string | null;
  raw_owner: string | null;
  status: string;
  evidence_status: string | null;
}

export function getDemoSessionsByWeek(): Record<string, DemoSessionRow[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.id, b.name as brand_name, d.location, d.session_label, d.sku_name, d.week_code,
              d.raw_owner, d.status, d.evidence_status
       FROM deliverables d
       LEFT JOIN brands b ON b.id = d.brand_id
       WHERE d.subtype = 'Demo'
       ORDER BY d.week_code, d.location`
    )
    .all() as DemoSessionRow[];

  const grouped: Record<string, DemoSessionRow[]> = {};
  for (const r of rows) {
    const key = r.week_code ?? "Unscheduled";
    (grouped[key] ??= []).push(r);
  }
  return grouped;
}
