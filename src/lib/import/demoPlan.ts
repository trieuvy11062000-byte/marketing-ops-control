import type Database from "better-sqlite3";
import { loadSheetRows } from "./excelHelpers";
import { cleanStr, slugify } from "./utils";
import { upsertBrand, upsertControlTask, upsertDeliverable } from "../db/repo";

function weekStartDate(db: Database.Database, weekCode: string): string | null {
  const r = db.prepare("SELECT start_date FROM weeks WHERE week_code = ?").get(weekCode) as { start_date: string } | undefined;
  return r?.start_date ?? null;
}

export function importDemoPlan(db: Database.Database, filePath: string) {
  const rows = loadSheetRows(filePath, "Summary");
  let deliverablesCreated = 0;
  let sessionsSeen = 0;

  let currentWeekCode: string | null = null;
  let lastShop: string | null = null;
  let lastFolder: string | null = null;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const col0 = cleanStr(row[0]);

    if (col0 && col0.toLowerCase().includes("demo schedule")) {
      const match = col0.match(/W(\d{1,2})/i);
      currentWeekCode = match ? `W${match[1].padStart(2, "0")}` : currentWeekCode;
      lastShop = null;
      lastFolder = null;
      continue;
    }
    if (col0 === "Shop") continue; // repeated header row

    const shop: string | null = cleanStr(row[0]) ?? lastShop;
    const time = cleanStr(row[1]);
    const theme = cleanStr(row[2]);
    const operatedBy = cleanStr(row[3]);
    const brandName = cleanStr(row[4]);
    const folder: string | null = cleanStr(row[5]) ?? lastFolder;
    const pic = cleanStr(row[6]);

    if (!shop || !brandName) continue; // blank separator row

    lastShop = shop;
    if (cleanStr(row[5])) lastFolder = folder;

    const weekCode = currentWeekCode ?? "W40";
    sessionsSeen++;

    // Demo sessions aren't tied to a formal Campaign in the source data — campaign_id
    // stays null rather than inventing one. They're still fully addressable via
    // brand + week + location (see the Demo Events module).
    const brandId = upsertBrand(db, brandName, "MONTHLY DEMO Plan / Summary");

    const deliverableId = `DEMO-${weekCode}__${slugify(shop)}__${slugify(theme, time)}`;
    const controlDate = weekStartDate(db, weekCode);

    upsertDeliverable(db, {
      id: deliverableId,
      campaign_id: null,
      brand_id: brandId,
      workstream: "Retail/In-store",
      subtype: "Demo",
      sku_code: null,
      sku_name: theme,
      location: shop,
      session_label: time,
      pic_role: "Retail Marketing",
      raw_owner: `${operatedBy ?? ""}${pic ? " / " + pic : ""}`.trim() || null,
      execution_date: controlDate,
      execution_deadline: controlDate,
      week_code: weekCode,
      evidence_required: 1,
      evidence_status: "PENDING",
      status: "IN PROGRESS",
      source_file: filePath,
      source_sheet: "Summary",
      source_row_ref: `row ${r + 1}: ${shop} ${time ?? ""} (${folder ?? "no folder code"})`,
    });
    deliverablesCreated++;

    upsertControlTask(db, {
      id: `CT__${deliverableId}`,
      deliverable_id: deliverableId,
      leader_action: "Verify",
      title: `Verify Demo Readiness — ${shop} — ${brandName}${time ? ` (${time})` : ""}`,
      control_date: controlDate,
      week_code: weekCode,
      status: "IN PROGRESS",
      next_action: `Confirm ${operatedBy ?? "operator"} readiness; audit evidence after session (${time ?? "time TBC"})`,
      issue_blocker: null,
      external_commitment: operatedBy === "Supplier" ? 1 : 0,
      external_deadline: operatedBy === "Supplier" ? controlDate : null,
      external_delivery_status: null,
      deliverable: { subtype: "Demo", execution_date: controlDate, evidence_required: 1, evidence_status: "PENDING" },
    });
  }

  return { deliverablesCreated, sessionsSeen };
}
