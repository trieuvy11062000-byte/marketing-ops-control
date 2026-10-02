import type Database from "better-sqlite3";
import { loadSheetRows } from "./excelHelpers";
import { cleanStr, toIsoDate } from "./utils";
import { upsertDigitalActivity } from "../db/repo";
import { weekCodeForDate } from "../db/weeks";

// RT Digital26: one row can carry a Social post AND/OR a Retail Email, independently.
// Confirmed fixed layout from the live source (see conversation inventory).
const COL = {
  week: 1,
  postingDate: 2,
  date: 3,
  bestTime: 4,
  mktType: 5,
  postType: 6,
  campaignName: 7,
  designStatus: 8,
  publishStatus: 9,
  plannedCaption: 10,
  emailCampaignName: 18,
  headline: 19,
};

export function importDigitalContent(db: Database.Database, filePath: string, sheet: string) {
  const rows = loadSheetRows(filePath, sheet);
  let socialCreated = 0;
  let emailCreated = 0;
  let lastWeekCode: string | null = null;

  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    const weekRaw = cleanStr(row[COL.week]);
    if (weekRaw) {
      const m = weekRaw.match(/W(\d{1,2})/i);
      if (m) lastWeekCode = `W${m[1].padStart(2, "0")}`;
    }
    const postDate = toIsoDate(row[COL.date]) ?? toIsoDate(row[COL.postingDate]);
    const weekCode = postDate ? weekCodeForDate(postDate) ?? lastWeekCode : lastWeekCode;

    const socialCampaign = cleanStr(row[COL.campaignName]);
    if (socialCampaign) {
      const platform = cleanStr(row[COL.postType]) ?? cleanStr(row[COL.mktType]);
      const id = `DGT__RTSOCIAL__${sheet}__${r}`;
      upsertDigitalActivity(db, {
        id,
        subtype: "Social",
        channel_scope: "RETAIL",
        platform,
        title: socialCampaign,
        driver: /tasting|demo/i.test(socialCampaign) ? "DEMO" : "CAMPAIGN",
        planned_date: postDate,
        post_date: postDate,
        status: cleanStr(row[COL.publishStatus]) ?? cleanStr(row[COL.designStatus]),
        approval_status: cleanStr(row[COL.designStatus]),
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}: ${cleanStr(row[COL.bestTime]) ?? ""}`,
      });
      socialCreated++;
    }

    const emailCampaign = cleanStr(row[COL.emailCampaignName]);
    if (emailCampaign) {
      const id = `DGT__RTEMAIL__${sheet}__${r}`;
      upsertDigitalActivity(db, {
        id,
        subtype: "Email",
        channel_scope: "RETAIL",
        title: emailCampaign,
        driver: /tasting|demo/i.test(emailCampaign) ? "DEMO" : "CAMPAIGN",
        planned_date: postDate,
        post_date: postDate,
        status: cleanStr(row[COL.headline]) ? "Drafted" : null,
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}`,
      });
      emailCreated++;
    }
  }

  return { socialCreated, emailCreated };
}
