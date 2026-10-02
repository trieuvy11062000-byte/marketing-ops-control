import type Database from "better-sqlite3";
import { loadSheetRows } from "./excelHelpers";
import { cleanStr, toIsoDate } from "./utils";
import { upsertDigitalActivity } from "../db/repo";
import { weekCodeForDate } from "../db/weeks";

// Note: this sheet's column A has no cells defined at all (not even blank/styled
// ones), so SheetJS omits that slot entirely — indices here are one lower than
// what openpyxl reports for the same sheet. Verified directly against SheetJS output.
const COL = { pillar: 0, execution: 1, brand: 6, postingDate: 7, status: 8 };

// DGTCalendar stacks two unrelated tables in one sheet: a clean Branded Video
// table (Pillar/Execution/Format/Brand/Posting Date/Status), followed by an
// entirely different weekly content-pillar mini-calendar grid (month header,
// MON-SUN day headers, multi-line event text per weekday cell). Only the first
// table is itemized rows we can safely parse — stop at its section boundary.
const SECTION_BREAK = /^(retail|wholesale)$/i;

export function importDigitalVideo(db: Database.Database, filePath: string) {
  const sheet = "DGTCalendar";
  const rows = loadSheetRows(filePath, sheet);
  let created = 0;

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const pillar = cleanStr(row[COL.pillar]);
    const brand = cleanStr(row[COL.brand]);
    if (pillar && SECTION_BREAK.test(pillar)) break; // hit the day-grid section — stop here

    const postDate = toIsoDate(row[COL.postingDate]);
    if (!postDate) continue; // the day-grid section has no parseable date in this column — skip, don't guess
    if (!pillar && !brand) continue;

    upsertDigitalActivity(db, {
      id: `DGT__VIDEO__${r}`,
      subtype: "Video",
      channel_scope: "SHARED",
      title: [pillar, cleanStr(row[COL.execution])].filter(Boolean).join(" — ") || brand || "Branded Video",
      driver: "CAMPAIGN",
      planned_date: postDate,
      post_date: postDate,
      status: cleanStr(row[COL.status]),
      week_code: postDate ? weekCodeForDate(postDate) : null,
      source_file: filePath,
      source_sheet: sheet,
      source_row_ref: `row ${r + 1}: brand=${brand ?? "-"}`,
    });
    created++;
  }

  return { created };
}
