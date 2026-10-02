import type Database from "better-sqlite3";
import { buildHeaderMap, cell, findCol, loadSheetRows } from "./excelHelpers";
import { cleanStr, slugify } from "./utils";
import { upsertApDeliveryLine, upsertApPackage, upsertBrand } from "../db/repo";

function derivePackageStatus(projectStatus: string | null): "IN DELIVERY" | "COMPLETED" | "AWAITING PROPOSAL" {
  const s = (projectStatus ?? "").toLowerCase();
  if (s.includes("not yet")) return "AWAITING PROPOSAL";
  if (s.includes("done") || s.includes("completed") || s.includes("paid")) return "COMPLETED";
  return "IN DELIVERY";
}

export function importApPlan(db: Database.Database, filePath: string) {
  const rows = loadSheetRows(filePath, "A&P26");
  if (rows.length < 3) return { deliveryLinesCreated: 0, packagesCreated: 0, suppliersSeen: 0 };
  const headerMap = buildHeaderMap(rows[1]); // row 2 (index 1) holds the real headers

  const colSupplierName = findCol(headerMap, "supplier name");
  const colProjectStatus = findCol(headerMap, "project status");
  const colApType = findCol(headerMap, "a&p types");
  const colQ3Claimed = findCol(headerMap, "quarter iii- claimed");
  const colOct = findCol(headerMap, "october");
  const colNov = findCol(headerMap, "november");
  const colDec = findCol(headerMap, "december");

  let deliveryLinesCreated = 0;
  let packagesCreated = 0;
  let suppliersSeen = 0;

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const supplierName = cleanStr(cell(row, colSupplierName));
    if (!supplierName) continue;
    suppliersSeen++;
    packagesCreated++;

    const brandId = upsertBrand(db, supplierName, "A&P26");
    const projectStatus = cleanStr(cell(row, colProjectStatus));
    const apType = cleanStr(cell(row, colApType)) ?? "A&P";

    const packageId = `APKG-${slugify(supplierName)}`;
    upsertApPackage(db, {
      id: packageId,
      brand_id: brandId,
      name: `${supplierName} — ${apType}`,
      period_start: "2026-01-01",
      period_end: "2026-12-31",
      status: derivePackageStatus(projectStatus),
      source_file: filePath,
      source_sheet: "A&P26",
    });

    // Q3 claim reconciliation — "Quarter III- Claimed USD" is a real numeric amount once claimed, blank until then.
    const q3ClaimedRaw = cell(row, colQ3Claimed);
    const q3Claimed = typeof q3ClaimedRaw === "number" && q3ClaimedRaw > 0;
    upsertApDeliveryLine(db, {
      id: `${packageId}__Q3-REPORT`,
      package_id: packageId,
      deliverable_type: "Q3 Campaign Report & Claim",
      agreed_label: "Report + claim due after quarter close",
      evidence_status: q3Claimed ? "COMPLETE" : "PENDING",
      reported: q3Claimed ? 1 : 0,
      status: q3Claimed ? "DELIVERED" : "IN DELIVERY",
      period_start: "2026-07-01",
      period_end: "2026-09-30",
      source_file: filePath,
      source_sheet: "A&P26",
      source_row_ref: `row ${r + 1}: ${supplierName} Q3 claimed USD=${q3ClaimedRaw ?? "-"}`,
    });
    deliveryLinesCreated++;

    // Q4 activity — only when there is an actual planned activity noted for Oct/Nov/Dec.
    const q4Activity = [cell(row, colOct), cell(row, colNov), cell(row, colDec)]
      .map(cleanStr)
      .filter((v): v is string => Boolean(v))
      .join("; ");
    if (q4Activity) {
      upsertApDeliveryLine(db, {
        id: `${packageId}__Q4-ACTIVITY`,
        package_id: packageId,
        deliverable_type: "Q4 Campaign Activity",
        agreed_label: q4Activity,
        evidence_status: "PENDING",
        reported: 0,
        status: "PENDING",
        period_start: "2026-10-01",
        period_end: "2026-12-31",
        source_file: filePath,
        source_sheet: "A&P26",
        source_row_ref: `row ${r + 1}: ${supplierName} Q4 activity=${q4Activity}`,
      });
      deliveryLinesCreated++;
    }
  }

  return { deliveryLinesCreated, packagesCreated, suppliersSeen };
}
