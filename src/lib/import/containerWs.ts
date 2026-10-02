import type Database from "better-sqlite3";
import { loadSheetRows } from "./excelHelpers";
import { cleanStr, toIsoDate } from "./utils";
import { upsertDigitalActivity, upsertSupplySignal } from "../db/repo";
import { weekCodeForDate } from "../db/weeks";
import type { DigitalSubtype, ChannelScope } from "../db/types";

// Container+WS26 — confirmed fixed layout from the live source.
const COL = {
  supplier: 1,
  po: 2,
  containerNo: 3,
  eta: 4,
  location: 5,
  containerStatus: 7,
  month: 8,
  productName: 9,
  title: 16,
  stockSituation: 27,
  wholesaleEmail: 28,
  wsWebsiteBanner: 29,
  retailEmail: 30,
  retailWebsiteBanner: 31,
  recommendedMessage: 32,
};

const DEPENDENCY_FLAGS: Array<{ col: number; subtype: DigitalSubtype; scope: ChannelScope; label: string }> = [
  { col: COL.wholesaleEmail, subtype: "Email", scope: "WHOLESALE", label: "Wholesale Email" },
  { col: COL.wsWebsiteBanner, subtype: "Website", scope: "WHOLESALE", label: "WS Website Banner" },
  { col: COL.retailEmail, subtype: "Email", scope: "RETAIL", label: "Retail Email" },
  { col: COL.retailWebsiteBanner, subtype: "Website", scope: "RETAIL", label: "Retail Website Banner" },
];

export function importContainerWs(db: Database.Database, filePath: string) {
  const sheet = "Container+WS26";
  const rows = loadSheetRows(filePath, sheet);
  let signalsCreated = 0;
  let digitalCreated = 0;

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    const supplier = cleanStr(row[COL.supplier]);
    if (!supplier) continue;

    const eta = toIsoDate(row[COL.eta]);
    const weekCode = eta ? weekCodeForDate(eta) : null;
    const signalId = `SUP__WS__${r}`;
    const productLabel = cleanStr(row[COL.productName]) ?? cleanStr(row[COL.title]);

    upsertSupplySignal(db, {
      id: signalId,
      signal_type: "CONTAINER",
      supplier,
      container_no: cleanStr(row[COL.containerNo]),
      product_label: productLabel,
      eta,
      location: cleanStr(row[COL.location]),
      note: cleanStr(row[COL.recommendedMessage]),
      status: cleanStr(row[COL.containerStatus]) ?? cleanStr(row[COL.stockSituation]),
      channel_scope: "WHOLESALE",
      week_code: weekCode,
      source_file: filePath,
      source_sheet: sheet,
      source_row_ref: `row ${r + 1}: month=${cleanStr(row[COL.month]) ?? "-"}`,
    });
    signalsCreated++;

    for (const flag of DEPENDENCY_FLAGS) {
      const value = cleanStr(row[flag.col]);
      if (!value) continue;
      upsertDigitalActivity(db, {
        id: `DGT__WS__${r}__${flag.label.replace(/\s+/g, "")}`,
        subtype: flag.subtype,
        channel_scope: flag.scope,
        title: productLabel ? `${supplier} — ${productLabel}` : supplier,
        brand_id: null,
        supply_signal_id: signalId,
        driver: "CONTAINER",
        planned_date: eta,
        status: value,
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}: ${flag.label}`,
      });
      digitalCreated++;
    }
  }

  return { signalsCreated, digitalCreated };
}
