import type Database from "better-sqlite3";
import { upsertApDeliveryLine, upsertApPackage } from "./repo";

const SOURCE = "A&P restructure spec — supplied 2026-10-02";

/** Seeds a Dongwon A&P proposal from the example activity list supplied in the
 *  spec (Golden Week, Monthly Campaign, Tasting, Branded Gondola, TVC, Email
 *  Marketing). No Qty/Fee/PIC figures were given for these — they stay null
 *  rather than invented; status is AWAITING PROPOSAL until real commercial
 *  terms are supplied. */
export function seedApExamples(db: Database.Database): void {
  const packageId = "APKG-DONGWON";
  upsertApPackage(db, {
    id: packageId,
    brand_id: "DONGWON",
    name: "Dongwon",
    period_start: null,
    period_end: null,
    total_value: null,
    lgd_fund: null,
    brand_investment: null,
    status: "AWAITING PROPOSAL",
    source_file: SOURCE,
    source_sheet: "A&P spec example",
  });

  const activities = ["Golden Week", "Monthly Campaign", "Tasting", "Branded Gondola", "TVC", "Email Marketing"];
  activities.forEach((type, i) => {
    upsertApDeliveryLine(db, {
      id: `${packageId}-L${i}`,
      package_id: packageId,
      deliverable_type: type,
      agreed_label: "Scope example only — Qty/Fee not yet confirmed",
      evidence_status: "PENDING",
      reported: 0,
      status: "PENDING",
      source_module: null,
      link_brand_id: "DONGWON",
      source_file: SOURCE,
      source_sheet: "A&P spec example",
    });
  });

  db.prepare(
    `INSERT INTO ap_campaign_reports (id, package_id, status) VALUES (?, ?, 'COLLECTING')
     ON CONFLICT(id) DO NOTHING`
  ).run(`${packageId}-REPORT`, packageId);
}
