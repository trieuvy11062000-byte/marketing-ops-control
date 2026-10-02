import type Database from "better-sqlite3";
import { loadSheetRows } from "./excelHelpers";
import { cleanStr, toIsoDate } from "./utils";
import { upsertDigitalActivity, upsertSupplySignal } from "../db/repo";

// Enew26 is two logical tables side by side (confirmed from live source):
// cols 9-21: Retail email/newsletter tracking. cols 23-29: container arrivals.
const EMAIL_COL = {
  week: 9,
  month: 10,
  campaignName: 11,
  campaignType: 14,
  emailStatus: 19,
  websiteBannerStatus: 20,
  socialStatus: 21,
};

const CONTAINER_COL = {
  supplier: 23,
  po: 24,
  containerNo: 25,
  eta: 26,
  location: 27,
  note: 28,
  status: 29,
};

export function importEnewContainer(db: Database.Database, filePath: string, sheet: string) {
  const rows = loadSheetRows(filePath, sheet);
  let emailCreated = 0;
  let containerCreated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    const campaignName = cleanStr(row[EMAIL_COL.campaignName]);
    if (campaignName) {
      const weekRaw = cleanStr(row[EMAIL_COL.week]);
      const weekCode = weekRaw ? `W${weekRaw.replace(/^W/i, "").padStart(2, "0")}` : null;
      const campaignType = cleanStr(row[EMAIL_COL.campaignType]);
      upsertDigitalActivity(db, {
        id: `DGT__ENEW__${sheet}__${r}`,
        subtype: "Email",
        channel_scope: "RETAIL",
        title: campaignType ? `${campaignName} — ${campaignType}` : campaignName,
        driver: "CAMPAIGN",
        status: cleanStr(row[EMAIL_COL.emailStatus]),
        approval_status: cleanStr(row[EMAIL_COL.socialStatus]),
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}: type=${cleanStr(row[EMAIL_COL.campaignType]) ?? "-"} banner=${cleanStr(row[EMAIL_COL.websiteBannerStatus]) ?? "-"} month=${cleanStr(row[EMAIL_COL.month]) ?? "-"}`,
      });
      emailCreated++;
    }

    const supplier = cleanStr(row[CONTAINER_COL.supplier]);
    if (supplier) {
      const eta = toIsoDate(row[CONTAINER_COL.eta]);
      upsertSupplySignal(db, {
        id: `SUP__ENEW__${sheet}__${r}`,
        signal_type: "CONTAINER",
        supplier,
        container_no: cleanStr(row[CONTAINER_COL.containerNo]),
        product_label: cleanStr(row[CONTAINER_COL.po]),
        eta,
        location: cleanStr(row[CONTAINER_COL.location]),
        note: cleanStr(row[CONTAINER_COL.note]),
        status: cleanStr(row[CONTAINER_COL.status]),
        channel_scope: "SHARED",
        week_code: null,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}`,
      });
      containerCreated++;
    }
  }

  return { emailCreated, containerCreated };
}
