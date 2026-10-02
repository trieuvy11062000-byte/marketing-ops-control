import type Database from "better-sqlite3";
import { cell, loadSheetRows } from "./excelHelpers";
import { campaignGroupId, campaignGroupName, cleanStr, parseCampaignCode, toIsoDate, weekCodeFromDateOrCode } from "./utils";
import { upsertCampaign, upsertPromotion } from "../db/repo";

// Verified fixed layout for W##-ONLINE sheets (Monthly Promotion files):
// 0 Status(NEW/ADJUST) 1 Product Owner 2 Product Code 3 Product Name 4 Best Before
// 5 Campaign Code 6 RTO campaign code 7 RTO note 8 RTO start 9 RTO valid-until
// 10 WSO campaign code 11 WSO note 12 WSO start 13 WSO valid-until
const COL = {
  status: 0,
  productOwner: 1,
  productCode: 2,
  productName: 3,
  campaignCode: 5,
  rtoCode: 6,
  rtoNote: 7,
  rtoStart: 8,
  rtoEnd: 9,
  wsoCode: 10,
  wsoNote: 11,
  wsoStart: 12,
  wsoEnd: 13,
};

export function importPromotionOnline(db: Database.Database, filePath: string, sheet: string) {
  const rows = loadSheetRows(filePath, sheet);
  let promotionsCreated = 0;
  if (rows.length < 3) return { promotionsCreated };

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const productCode = cleanStr(cell(row, COL.productCode));
    const campaignCode = cleanStr(cell(row, COL.campaignCode));
    if (!productCode || !campaignCode) continue;

    const parsed = parseCampaignCode(campaignCode);
    const campaignId = campaignGroupId(parsed);
    upsertCampaign(db, {
      id: campaignId,
      brand_id: null,
      name: campaignGroupName(parsed),
      campaign_type: parsed.campaignType,
      quarter: null,
      month: parsed.monthToken,
      theme: null,
      sourceFile: filePath,
      sourceSheet: sheet,
    });

    const productName = cleanStr(cell(row, COL.productName));
    const productOwner = cleanStr(cell(row, COL.productOwner));
    const status = cleanStr(cell(row, COL.status));

    const rtoCode = cleanStr(cell(row, COL.rtoCode));
    const rtoStart = toIsoDate(cell(row, COL.rtoStart));
    const rtoEnd = toIsoDate(cell(row, COL.rtoEnd));
    if (rtoCode || rtoStart) {
      const weekCode = weekCodeFromDateOrCode(rtoStart, parsed);
      upsertPromotion(db, {
        id: `PRO__${campaignCode}__ONLINE-RETAIL__${productCode}`,
        brand_id: null,
        campaign_id: campaignId,
        sku_code: productCode,
        sku_name: productName,
        channel: "ONLINE-RETAIL",
        customer_type: "Retail",
        mechanic: rtoCode,
        normal_price: null,
        promotion_price: null,
        discount_label: cleanStr(cell(row, COL.rtoNote)) ?? rtoCode,
        start_date: rtoStart,
        end_date: rtoEnd,
        stores_platform: "Retail Website",
        setup_status: status?.toUpperCase().includes("NEW") ? "PENDING" : "DONE",
        audit_status: "PENDING",
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}: owner=${productOwner ?? "-"}`,
      });
      promotionsCreated++;
    }

    const wsoCode = cleanStr(cell(row, COL.wsoCode));
    const wsoStart = toIsoDate(cell(row, COL.wsoStart));
    const wsoEnd = toIsoDate(cell(row, COL.wsoEnd));
    if (wsoCode || wsoStart) {
      const weekCode = weekCodeFromDateOrCode(wsoStart, parsed);
      upsertPromotion(db, {
        id: `PRO__${campaignCode}__ONLINE-WHOLESALE__${productCode}`,
        brand_id: null,
        campaign_id: campaignId,
        sku_code: productCode,
        sku_name: productName,
        channel: "ONLINE-WHOLESALE",
        customer_type: "Wholesale",
        mechanic: wsoCode,
        normal_price: null,
        promotion_price: null,
        discount_label: cleanStr(cell(row, COL.wsoNote)) ?? wsoCode,
        start_date: wsoStart,
        end_date: wsoEnd,
        stores_platform: "Wholesale Website",
        setup_status: status?.toUpperCase().includes("NEW") ? "PENDING" : "DONE",
        audit_status: "PENDING",
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}: owner=${productOwner ?? "-"}`,
      });
      promotionsCreated++;
    }
  }

  return { promotionsCreated };
}
