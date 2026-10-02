import type Database from "better-sqlite3";
import { loadSheetRows } from "./excelHelpers";
import { cleanStr, slugify } from "./utils";
import { upsertApDeliveryLine, upsertApPackage, upsertBrand } from "../db/repo";

/** Counts executed Demo deliverables whose brand name loosely matches the supplier name (case-insensitive substring, either direction). */
function countExecuted(db: Database.Database, supplierName: string): number {
  const rows = db
    .prepare(
      `SELECT b.name, COUNT(*) c FROM deliverables d
       JOIN brands b ON b.id = d.brand_id
       WHERE d.subtype = 'Demo'
       GROUP BY b.name`
    )
    .all() as { name: string; c: number }[];
  const needle = supplierName.toLowerCase();
  let total = 0;
  for (const r of rows) {
    const hay = r.name.toLowerCase();
    if (hay.includes(needle) || needle.includes(hay)) total += r.c;
  }
  return total;
}

/** Finds an existing A&P package for a brand name via fuzzy (case-insensitive substring) match. */
function findExistingPackage(db: Database.Database, supplierName: string): string | null {
  const packages = db
    .prepare(`SELECT ap.id, b.name FROM ap_packages ap JOIN brands b ON b.id = ap.brand_id`)
    .all() as { id: string; name: string }[];
  const needle = supplierName.toLowerCase();
  for (const p of packages) {
    const hay = p.name.toLowerCase();
    if (hay.includes(needle) || needle.includes(hay)) return p.id;
  }
  return null;
}

/** Imports Supplier Tracker (agreed Demo session commitments) as an A&P delivery line
 *  — merged into an existing package for the brand where one exists, or a standalone
 *  "Demo Commitment" package otherwise. Never duplicates the Demo execution records;
 *  delivered_quantity is aggregated live from the Demo module. */
export function importApDemoDelivery(db: Database.Database, filePath: string) {
  const rows = loadSheetRows(filePath, "Supplier Tracker");
  let deliveryLinesCreated = 0;
  let lastSupplier: string | null = null;

  const agreedBySupplier = new Map<string, { agreed: number; reasons: Set<string>; operatedBy: Set<string> }>();

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const reason = cleanStr(row[0]);
    const supplier: string | null = cleanStr(row[1]) ?? lastSupplier;
    const sessionsRaw = row[2];
    const operatedBy = cleanStr(row[3]);

    if (!supplier || typeof sessionsRaw !== "number") continue;
    if (supplier.toUpperCase().includes("TOTAL") || (reason ?? "").toUpperCase().includes("TOTAL")) continue;
    lastSupplier = supplier;

    const entry = agreedBySupplier.get(supplier) ?? { agreed: 0, reasons: new Set(), operatedBy: new Set() };
    entry.agreed += sessionsRaw;
    if (reason) entry.reasons.add(reason);
    if (operatedBy) entry.operatedBy.add(operatedBy);
    agreedBySupplier.set(supplier, entry);
  }

  for (const [supplier, { agreed, reasons, operatedBy }] of agreedBySupplier) {
    const brandId = upsertBrand(db, supplier, "Supplier Tracker");
    let packageId = findExistingPackage(db, supplier);

    if (!packageId) {
      packageId = `APKG-DEMO-${slugify(supplier)}`;
      upsertApPackage(db, {
        id: packageId,
        brand_id: brandId,
        name: `${supplier} — Demo Commitment`,
        period_start: "2026-10-01",
        period_end: "2026-10-31",
        status: "IN DELIVERY",
        source_file: filePath,
        source_sheet: "Supplier Tracker",
      });
    }

    const executed = countExecuted(db, supplier);
    const evidence = executed >= agreed && agreed > 0 ? "COMPLETE" : executed > 0 ? "PARTIAL" : "PENDING";
    const status = executed >= agreed && agreed > 0 ? "DELIVERED" : executed > 0 ? "IN DELIVERY" : "PENDING";

    upsertApDeliveryLine(db, {
      id: `${packageId}__TASTING`,
      package_id: packageId,
      deliverable_type: "Tasting",
      agreed_label: `${agreed} Sessions`,
      agreed_quantity: agreed,
      delivered_quantity: executed,
      evidence_status: evidence,
      reported: 0,
      status,
      source_module: "Demo",
      link_brand_id: brandId,
      link_subtype: "Demo",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      source_file: filePath,
      source_sheet: "Supplier Tracker",
      source_row_ref: `${[...reasons].join(", ") || "—"} · ${[...operatedBy].join(", ") || "—"}`,
    });
    deliveryLinesCreated++;
  }

  return { deliveryLinesCreated };
}
