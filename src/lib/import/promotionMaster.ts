import type Database from "better-sqlite3";
import { buildHeaderMap, cell, findCol, loadSheetRows } from "./excelHelpers";
import { campaignGroupId, campaignGroupName, parseCampaignCode, toIsoDate, weekCodeFromDateOrCode } from "./utils";
import { upsertCampaign, upsertPromotion } from "../db/repo";

type SheetCategory = "FULL" | "DRAFT" | "NEW" | "ADJUST" | "REMOVE";

const SHEET_CONFIG: Array<{ sheet: string; category: SheetCategory }> = [
  { sheet: "FULL", category: "FULL" },
  { sheet: "Draft", category: "DRAFT" },
  { sheet: "W39-NEW", category: "NEW" },
  { sheet: "W39-ADJUST", category: "ADJUST" },
  { sheet: "W39-REMOVE", category: "REMOVE" },
  { sheet: "W40-NEW", category: "NEW" },
  { sheet: "W40-ADJUST", category: "ADJUST" },
  { sheet: "W40-REMOVE", category: "REMOVE" },
];

/** In-store promotion setup/audit defaults per sheet category. */
const CATEGORY_META: Record<SheetCategory, { setup: "PENDING" | "DONE"; audit: "PENDING" | "AUDITED" }> = {
  FULL: { setup: "DONE", audit: "PENDING" }, // audit resolved per-row below from "Promo Display Done"
  DRAFT: { setup: "PENDING", audit: "PENDING" },
  NEW: { setup: "PENDING", audit: "PENDING" },
  ADJUST: { setup: "PENDING", audit: "PENDING" },
  REMOVE: { setup: "DONE", audit: "PENDING" }, // needs removal audit
};

export function importPromotionMaster(db: Database.Database, filePath: string) {
  let promotionsCreated = 0;
  let campaignsTouched = 0;
  const seenCampaigns = new Set<string>();

  for (const { sheet, category } of SHEET_CONFIG) {
    const rows = loadSheetRows(filePath, sheet);
    if (rows.length < 2) continue;
    const headerMap = buildHeaderMap(rows[0]);

    const colProductCode = findCol(headerMap, "product code");
    const colProductName = findCol(headerMap, "product name");
    const colRetailPrice = findCol(headerMap, "retail price");
    const colPromoCode = findCol(headerMap, "promotional code");
    const colPromoDetail = findCol(headerMap, "promotion detail");
    const colStartDate = findCol(headerMap, "start date");
    const colValidUntil = findCol(headerMap, "valid until");
    const colAppliedShop = findCol(headerMap, "applied shop");
    const colExecNeed = findCol(headerMap, "shop execution need");
    const colInStock = findCol(headerMap, "in stock");
    const colDisplayDone = findCol(headerMap, "promo display done");

    const meta = CATEGORY_META[category];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const productCode = cell(row, colProductCode);
      if (productCode == null || String(productCode).trim() === "") continue;

      const promoCodeRaw = cell(row, colPromoCode);
      if (promoCodeRaw == null || String(promoCodeRaw).trim() === "") continue;
      const promoCode = String(promoCodeRaw).trim();
      const parsed = parseCampaignCode(promoCode);

      const startDate = toIsoDate(cell(row, colStartDate));
      const validUntil = toIsoDate(cell(row, colValidUntil));
      const weekCode = weekCodeFromDateOrCode(startDate, parsed);

      const campaignId = campaignGroupId(parsed);
      if (!seenCampaigns.has(campaignId)) {
        seenCampaigns.add(campaignId);
        campaignsTouched++;
      }
      upsertCampaign(db, {
        id: campaignId,
        brand_id: null, // Promotion Master File rows aren't brand-tagged (no Supplier/Brand column) — left ungrouped, not guessed.
        name: campaignGroupName(parsed),
        campaign_type: parsed.campaignType,
        quarter: null,
        month: parsed.monthToken,
        theme: null,
        sourceFile: filePath,
        sourceSheet: sheet,
      });

      const displayDone = cell(row, colDisplayDone);
      const auditStatus: "PENDING" | "AUDITED" =
        category === "FULL" && displayDone && String(displayDone).toUpperCase().startsWith("Y") ? "AUDITED" : meta.audit;

      const promotionId = `PRO__${promoCode}__${category}__${productCode}`;
      upsertPromotion(db, {
        id: promotionId,
        brand_id: null,
        campaign_id: campaignId,
        sku_code: String(productCode),
        sku_name: cell(row, colProductName) ? String(cell(row, colProductName)) : null,
        channel: "IN-STORE",
        mechanic: cell(row, colPromoDetail) ? String(cell(row, colPromoDetail)) : null,
        normal_price: typeof cell(row, colRetailPrice) === "number" ? (cell(row, colRetailPrice) as number) : null,
        promotion_price: null,
        discount_label: cell(row, colPromoDetail) ? String(cell(row, colPromoDetail)) : null,
        start_date: startDate,
        end_date: validUntil,
        stores_platform: cell(row, colAppliedShop) ? String(cell(row, colAppliedShop)) : null,
        stock_status: cell(row, colInStock) ? String(cell(row, colInStock)) : null,
        setup_status: meta.setup,
        audit_status: auditStatus,
        week_code: weekCode,
        source_file: filePath,
        source_sheet: sheet,
        source_row_ref: `row ${r + 1}: ${cell(row, colExecNeed) ?? ""}`,
      });
      promotionsCreated++;
    }
  }

  return { promotionsCreated, campaignsTouched };
}
