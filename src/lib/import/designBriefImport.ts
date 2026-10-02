import type Database from "better-sqlite3";
import { upsertBrand } from "../db/repo";
import { parseDesignBriefWorkbook, parseDesignBriefWorkbookBuffer, type ParsedDesignAsset, type ParsedWorkbook } from "./designBrief";
import { classifyActivity } from "./designBriefActivity";
import {
  classifyBrandCandidate,
  detectMonthFromFileName,
  inferBrandFromProducts,
  looksLikeCategory,
  linkBrandCategory,
  upsertCategory,
  upsertMonthLedger,
  upsertPortfolio,
} from "./designBriefMasterData";
import { campaignGroupId, parseCampaignCode, slugify, toIsoDate } from "./utils";

interface BrandIndexEntry {
  id: string;
  norm: string;
}

function buildBrandIndex(db: Database.Database): BrandIndexEntry[] {
  return (db.prepare("SELECT id, name FROM brands").all() as { id: string; name: string }[]).map((b) => ({
    id: b.id,
    norm: b.name.toLowerCase().trim(),
  }));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches brand names against free text ONLY — never creates a new record.
 *  Exact match wins; otherwise the longest whole-word brand-name match across
 *  all candidate texts. Returns null when nothing in the text names a known
 *  brand (see resolveOrCreateBrand for the safe, narrow cases where a NEW
 *  brand may be created instead of merely matched). */
function matchBrand(index: BrandIndexEntry[], ...candidates: (string | null)[]): string | null {
  const texts = candidates.filter((c): c is string => !!c).map((c) => c.toLowerCase().trim());
  if (texts.length === 0) return null;

  for (const t of texts) {
    const exact = index.find((b) => b.norm === t);
    if (exact) return exact.id;
  }

  let best: { id: string; len: number } | null = null;
  for (const t of texts) {
    for (const b of index) {
      if (b.norm.length < 4) continue;
      const re = new RegExp(`\\b${escapeRegExp(b.norm)}\\b`, "i");
      if (re.test(t) && (!best || b.norm.length > best.len)) best = { id: b.id, len: b.norm.length };
    }
  }
  return best?.id ?? null;
}

/** Resolves a SHORT, standalone candidate name (not a free-text sentence) to a
 *  brand — matching an existing one, or safely creating a new one. Never called
 *  with campaign/theme freeform text (too risky — "Korean Street Flavours" is a
 *  campaign name, not a brand); only with narrow, structurally-reliable signals
 *  (a fixture name stripped of its fixture-type suffix, a product-name prefix
 *  shared by every SKU on an asset). Portfolio-pattern names (KFood, "SUP 56",
 *  "...Trading Ltd") are redirected to portfolios, never created as a Brand. */
function resolveOrCreateBrand(db: Database.Database, brandIndex: BrandIndexEntry[], name: string | null, sourceTag: string): { brandId: string | null; portfolioId: string | null } {
  if (!name) return { brandId: null, portfolioId: null };
  const trimmed = name.trim();
  if (!trimmed || trimmed.split(/\s+/).length > 5) return { brandId: null, portfolioId: null };
  const norm = trimmed.toLowerCase();

  const exact = brandIndex.find((b) => b.norm === norm);
  if (exact) return { brandId: exact.id, portfolioId: null };

  if (classifyBrandCandidate(trimmed) === "PORTFOLIO") {
    return { brandId: null, portfolioId: upsertPortfolio(db, trimmed, sourceTag) };
  }

  const id = upsertBrand(db, trimmed, sourceTag);
  brandIndex.push({ id, norm });
  return { brandId: id, portfolioId: null };
}

function stripFixtureSuffix(text: string): string {
  return text.replace(/\s*\b(gondola|fixture|display|stand|unit)\b\s*$/i, "").trim();
}

/** Only links to a campaign that already exists (from the Marketing Calendar
 *  import) — a design brief never creates a new Campaign record. */
function matchCampaign(db: Database.Database, campaignCode: string | null): string | null {
  if (!campaignCode) return null;
  const parsed = parseCampaignCode(campaignCode);
  const groupId = campaignGroupId(parsed);
  const row = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(groupId) as { id: string } | undefined;
  return row?.id ?? null;
}

const PROMO_CHANNEL_MAP: Record<string, string> = {
  "IN-STORE": "IN-STORE",
  "ONLINE RETAIL": "ONLINE-RETAIL",
  "BULK/WHOLESALE": "ONLINE-WHOLESALE",
  "LAST MILE": "LAST MILE",
};

/** Cross-links to an existing Promotion record only when there's exactly one
 *  product on the asset and a confidently-matched promotion channel — ambiguous
 *  multi-product assets are left unlinked rather than guessed. The Design Brief
 *  communicates the promotion; it never becomes the master source when a formal
 *  Promotion record exists, so mismatches are flagged, not silently overwritten. */
function matchPromotion(db: Database.Database, asset: ParsedDesignAsset): { id: string | null; conflict: boolean } {
  if (asset.products.length !== 1 || !asset.promotionChannel) return { id: null, conflict: false };
  const code = asset.products[0].code;
  if (!code) return { id: null, conflict: false };
  const channel = PROMO_CHANNEL_MAP[asset.promotionChannel];
  if (!channel) return { id: null, conflict: false };

  const row = db
    .prepare("SELECT id, mechanic FROM promotions WHERE sku_code = ? AND channel = ? LIMIT 1")
    .get(code, channel) as { id: string; mechanic: string | null } | undefined;
  if (!row) return { id: null, conflict: false };

  const briefMechanic = (asset.promotionMechanic ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const promoMechanic = (row.mechanic ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const conflict = !!briefMechanic && !!promoMechanic && briefMechanic !== promoMechanic && !briefMechanic.includes(promoMechanic) && !promoMechanic.includes(briefMechanic);
  return { id: row.id, conflict };
}

export interface DesignBriefImportResult {
  sheetsScanned: number;
  briefsImported: number;
  briefsExcluded: number;
  assetsCreated: number;
  productsCreated: number;
  activitiesCreated: number;
  brandsCreated: number;
  needsMappingAssets: number;
  monthLabel: string | null;
}

function writeParsedWorkbook(db: Database.Database, parsed: ParsedWorkbook): DesignBriefImportResult {
  const brandIndex = buildBrandIndex(db);
  const brandCountBefore = brandIndex.length;
  const fileBase = parsed.fileName.split(/[\\/]/).pop() ?? parsed.fileName;

  const result: DesignBriefImportResult = {
    sheetsScanned: parsed.briefs.length,
    briefsImported: 0,
    briefsExcluded: 0,
    assetsCreated: 0,
    productsCreated: 0,
    activitiesCreated: 0,
    brandsCreated: 0,
    needsMappingAssets: 0,
    monthLabel: null,
  };

  // ── Month Ledger — detected from the workbook's own file name, never
  // hard-coded. Falls back to the first parseable brief period/submission date.
  let detectedMonth = detectMonthFromFileName(fileBase);
  if (!detectedMonth) {
    for (const brief of parsed.briefs) {
      const iso = toIsoDate(brief.header.startRaw) ?? toIsoDate(brief.header.submissionDeadlineRaw);
      if (iso) { detectedMonth = { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) }; break; }
    }
  }
  const monthDbId = detectedMonth ? upsertMonthLedger(db, detectedMonth.year, detectedMonth.month) : null;
  if (monthDbId) {
    const row = db.prepare("SELECT month_label FROM months WHERE id = ?").get(monthDbId) as { month_label: string };
    result.monthLabel = row.month_label;
  }

  const insertBrief = db.prepare(
    `INSERT INTO design_briefs (id, campaign_name, brand_id, campaign_id, campaign_type, theme, cuisine,
        period_start, period_end, design_deadline, submission_deadline, a_and_p, sheet_kind, status,
        exclusion_reason, asset_count, source_file, source_sheet)
     VALUES (@id, @campaign_name, @brand_id, @campaign_id, @campaign_type, @theme, @cuisine,
        @period_start, @period_end, @design_deadline, @submission_deadline, @a_and_p, @sheet_kind, @status,
        @exclusion_reason, @asset_count, @source_file, @source_sheet)
     ON CONFLICT(id) DO UPDATE SET
       campaign_name = excluded.campaign_name, brand_id = excluded.brand_id, campaign_id = excluded.campaign_id,
       campaign_type = excluded.campaign_type, theme = excluded.theme, cuisine = excluded.cuisine,
       period_start = excluded.period_start, period_end = excluded.period_end,
       design_deadline = excluded.design_deadline, submission_deadline = excluded.submission_deadline,
       a_and_p = excluded.a_and_p, sheet_kind = excluded.sheet_kind, status = excluded.status,
       exclusion_reason = excluded.exclusion_reason, asset_count = excluded.asset_count, last_updated = datetime('now')`
  );
  const updateBriefBrand = db.prepare("UPDATE design_briefs SET brand_id = COALESCE(brand_id, ?) WHERE id = ?");

  // Non-audit fields only — leader audit state (brief_complete..ready_to_publish)
  // and evidence_link are intentionally excluded from the UPDATE clause so a
  // re-import of the same file never wipes out review progress.
  const insertAsset = db.prepare(
    `INSERT INTO design_assets (id, design_brief_id, activity_id, month_id, category_id, brand_id, campaign_id,
        asset_type, variant_label, channel, channel_subtype, format_raw, headline, secondary_message, cta,
        content_raw, promotion_mechanic, promotion_channel, promotion_id, promotion_conflict, valid_from,
        valid_until, design_deadline, branding_requirement, theme_ref, design_note, reusable_template,
        fixture_parent, confidence, source_file, source_sheet, source_row_ref)
     VALUES (@id, @design_brief_id, @activity_id, @month_id, @category_id, @brand_id, @campaign_id,
        @asset_type, @variant_label, @channel, @channel_subtype, @format_raw, @headline, @secondary_message, @cta,
        @content_raw, @promotion_mechanic, @promotion_channel, @promotion_id, @promotion_conflict, @valid_from,
        @valid_until, @design_deadline, @branding_requirement, @theme_ref, @design_note, @reusable_template,
        @fixture_parent, @confidence, @source_file, @source_sheet, @source_row_ref)
     ON CONFLICT(id) DO UPDATE SET
       activity_id = excluded.activity_id, month_id = excluded.month_id, category_id = excluded.category_id,
       brand_id = excluded.brand_id, campaign_id = excluded.campaign_id, asset_type = excluded.asset_type,
       variant_label = excluded.variant_label, channel = excluded.channel, channel_subtype = excluded.channel_subtype,
       format_raw = excluded.format_raw, headline = excluded.headline, secondary_message = excluded.secondary_message,
       cta = excluded.cta, content_raw = excluded.content_raw, promotion_mechanic = excluded.promotion_mechanic,
       promotion_channel = excluded.promotion_channel, promotion_id = excluded.promotion_id,
       promotion_conflict = excluded.promotion_conflict, valid_from = excluded.valid_from, valid_until = excluded.valid_until,
       design_deadline = excluded.design_deadline, branding_requirement = excluded.branding_requirement,
       theme_ref = excluded.theme_ref, design_note = excluded.design_note, reusable_template = excluded.reusable_template,
       fixture_parent = excluded.fixture_parent, confidence = excluded.confidence,
       source_file = excluded.source_file, source_sheet = excluded.source_sheet, source_row_ref = excluded.source_row_ref,
       last_updated = datetime('now')`
  );

  const deleteProducts = db.prepare("DELETE FROM design_asset_products WHERE design_asset_id = ?");
  const insertProduct = db.prepare(
    `INSERT INTO design_asset_products (id, design_asset_id, product_code, product_name, product_group, role_note, source_row_ref)
     VALUES (@id, @design_asset_id, @product_code, @product_name, @product_group, @role_note, @source_row_ref)`
  );

  const insertActivity = db.prepare(
    `INSERT INTO design_activities (id, month_id, design_brief_id, brand_id, portfolio_id, campaign_id,
        activity_type, activity_label, promotion_mechanic, promotion_channel, start_date, end_date,
        source_file, source_sheet)
     VALUES (@id, @month_id, @design_brief_id, @brand_id, @portfolio_id, @campaign_id,
        @activity_type, @activity_label, @promotion_mechanic, @promotion_channel, @start_date, @end_date,
        @source_file, @source_sheet)
     ON CONFLICT(id) DO UPDATE SET
       brand_id = excluded.brand_id, portfolio_id = excluded.portfolio_id, campaign_id = excluded.campaign_id,
       promotion_mechanic = excluded.promotion_mechanic, promotion_channel = excluded.promotion_channel,
       start_date = excluded.start_date, end_date = excluded.end_date, last_updated = datetime('now')`
  );

  const tx = db.transaction(() => {
    for (const brief of parsed.briefs) {
      const briefId = slugify(fileBase, brief.sheetName);
      const sourceTag = `${fileBase} / ${brief.sheetName}`;

      let brandId = matchBrand(brandIndex, brief.header.campaignName, brief.header.aAndP, brief.header.theme);
      let briefPortfolioId: string | null = null;
      if (!brandId && brief.fixtureParent) {
        const candidate = stripFixtureSuffix(brief.fixtureParent);
        const resolved = resolveOrCreateBrand(db, brandIndex, candidate, sourceTag);
        brandId = resolved.brandId;
        briefPortfolioId = resolved.portfolioId;
      }
      const campaignId = matchCampaign(db, brief.header.campaignCode);

      insertBrief.run({
        id: briefId,
        campaign_name: brief.header.campaignName,
        brand_id: brandId,
        campaign_id: campaignId,
        campaign_type: brief.header.campaignCode ? parseCampaignCode(brief.header.campaignCode).campaignType : null,
        theme: brief.header.theme,
        cuisine: brief.header.cuisine,
        period_start: toIsoDate(brief.header.startRaw),
        period_end: toIsoDate(brief.header.endRaw),
        design_deadline: brief.header.deadlineRaw,
        submission_deadline: toIsoDate(brief.header.submissionDeadlineRaw) ?? brief.header.submissionDeadlineRaw,
        a_and_p: brief.header.aAndP,
        sheet_kind: brief.sheetKind,
        status: brief.excluded ? "EXCLUDED" : "IMPORTED",
        exclusion_reason: brief.exclusionReason,
        asset_count: brief.assets.length,
        source_file: fileBase,
        source_sheet: brief.sheetName,
      });

      if (brief.excluded) { result.briefsExcluded++; continue; }
      result.briefsImported++;

      // Activity grouping: (brand, activityType, activityLabel) -> ONE design_activities row.
      // Assets sharing a group (e.g. Wobbler + Shelf Strip for the same In-store
      // Promotion) are the SAME Activity, never duplicated.
      const activityGroups = new Map<string, { activityType: string; activityLabel: string; brandId: string | null; portfolioId: string | null; mechanics: Set<string>; channels: Set<string>; starts: string[]; ends: string[] }>();

      const assetBrandIds: (string | null)[] = [];

      brief.assets.forEach((asset, idx) => {
        const assetId = `${briefId}__A${idx}`;
        let assetBrandId = matchBrand(brandIndex, asset.variantLabel) ?? brandId;
        let assetPortfolioId: string | null = briefPortfolioId;

        if (!assetBrandId) {
          const inferred = inferBrandFromProducts(asset.products);
          if (inferred) {
            const resolved = resolveOrCreateBrand(db, brandIndex, inferred, `${sourceTag} (product inference)`);
            assetBrandId = resolved.brandId;
            assetPortfolioId = assetPortfolioId ?? resolved.portfolioId;
          }
        }
        assetBrandIds.push(assetBrandId);

        // Category: only trusted on fixture/shelf-organising asset types (Shelf
        // Strip, Wobbler) — the only context in this hierarchy where the source
        // reliably uses variant text to mean "product category", not a creative
        // variant or product-line name (Email/eNews assets use the same field
        // for a specific product, e.g. "CUCKOO Rice Cooker" — not a category).
        let categoryId: string | null = null;
        const assetTypeNorm = (asset.assetType ?? "").toLowerCase();
        if (asset.variantLabel && (assetTypeNorm === "shelf strip" || assetTypeNorm === "wobbler") && looksLikeCategory(asset.variantLabel)) {
          const normVariant = asset.variantLabel.trim().toLowerCase();
          const collidesWithBrand = brandIndex.some((b) => b.norm === normVariant);
          // Pure product-group marketing names ("SOJU GROUP", "STREET FOOD HOT
          // PICKS") and anything matching a known Brand name stay variant-only.
          if (!collidesWithBrand && !/group$|picks$/i.test(asset.variantLabel.trim())) {
            categoryId = upsertCategory(db, asset.variantLabel.trim());
            if (assetBrandId) linkBrandCategory(db, assetBrandId, categoryId);
          }
        }

        const { activityType, activityLabel } = classifyActivity({
          sheetKind: brief.sheetKind,
          campaignType: brief.header.campaignCode ? parseCampaignCode(brief.header.campaignCode).campaignType : null,
          channel: asset.channel,
          promotionChannel: asset.promotionChannel,
          reusableTemplate: asset.reusableTemplate,
        });

        const groupKey = `${assetBrandId ?? "UNKNOWN"}__${activityType}__${activityLabel}`;
        const activityId = `${briefId}__ACT_${slugify(groupKey).slice(0, 60)}`;
        if (!activityGroups.has(groupKey)) {
          activityGroups.set(groupKey, { activityType, activityLabel, brandId: assetBrandId, portfolioId: assetPortfolioId, mechanics: new Set(), channels: new Set(), starts: [], ends: [] });
          // Insert the parent Activity row now — the asset row below has an FK
          // to it — then update it with aggregated values once every member
          // asset of the group has been seen (see the loop after this one).
          insertActivity.run({
            id: activityId, month_id: monthDbId, design_brief_id: briefId, brand_id: assetBrandId,
            portfolio_id: assetPortfolioId, campaign_id: campaignId, activity_type: activityType,
            activity_label: activityLabel, promotion_mechanic: null, promotion_channel: null,
            start_date: null, end_date: null, source_file: fileBase, source_sheet: brief.sheetName,
          });
        }
        const group = activityGroups.get(groupKey)!;
        if (asset.promotionMechanic) group.mechanics.add(asset.promotionMechanic);
        if (asset.promotionChannel) group.channels.add(asset.promotionChannel);
        if (asset.validFrom) group.starts.push(asset.validFrom);
        if (asset.validUntil) group.ends.push(asset.validUntil);

        // Brand is a required hierarchy field — an asset that still has none
        // after matching, fixture-name, and product-prefix inference is a real
        // mapping gap, not a parsing success, regardless of how cleanly the
        // rest of the row parsed.
        const confidence = assetBrandId ? asset.confidence : "NEEDS MAPPING";

        insertAsset.run({
          id: assetId,
          design_brief_id: briefId,
          activity_id: activityId,
          month_id: monthDbId,
          category_id: categoryId,
          brand_id: assetBrandId,
          campaign_id: campaignId,
          asset_type: asset.assetType,
          variant_label: asset.variantLabel,
          channel: asset.channel,
          channel_subtype: asset.channelSubtype,
          format_raw: asset.formatRaw,
          headline: asset.headline,
          secondary_message: asset.secondaryMessage,
          cta: asset.cta,
          content_raw: asset.contentRaw,
          promotion_mechanic: asset.promotionMechanic,
          promotion_channel: asset.promotionChannel,
          promotion_id: null, // set below once promotion cross-link is resolved
          promotion_conflict: 0,
          valid_from: asset.validFrom,
          valid_until: asset.validUntil,
          design_deadline: asset.designDeadline,
          branding_requirement: asset.brandingRequirement,
          theme_ref: asset.themeRef,
          design_note: asset.designNote,
          reusable_template: asset.reusableTemplate ? 1 : 0,
          fixture_parent: asset.fixtureParent,
          confidence,
          source_file: fileBase,
          source_sheet: brief.sheetName,
          source_row_ref: asset.sourceRowRef,
        });

        const { id: promotionId, conflict } = matchPromotion(db, asset);
        if (promotionId) {
          db.prepare("UPDATE design_assets SET promotion_id = ?, promotion_conflict = ? WHERE id = ?").run(promotionId, conflict ? 1 : 0, assetId);
        }

        result.assetsCreated++;
        if (confidence !== "HIGH") result.needsMappingAssets++;

        deleteProducts.run(assetId);
        asset.products.forEach((p, pidx) => {
          insertProduct.run({
            id: `${assetId}__P${pidx}`,
            design_asset_id: assetId,
            product_code: p.code,
            product_name: p.name,
            product_group: p.group,
            role_note: p.roleNote,
            source_row_ref: p.sourceRowRef,
          });
          result.productsCreated++;
        });
      });

      // Write the Activity parent rows now that every asset's group is known.
      for (const [groupKey, group] of activityGroups) {
        const activityId = `${briefId}__ACT_${slugify(groupKey).slice(0, 60)}`;
        const mechanics = [...group.mechanics];
        insertActivity.run({
          id: activityId,
          month_id: monthDbId,
          design_brief_id: briefId,
          brand_id: group.brandId,
          portfolio_id: group.portfolioId,
          campaign_id: campaignId,
          activity_type: group.activityType,
          activity_label: group.activityLabel,
          promotion_mechanic: mechanics.length === 0 ? null : mechanics.length === 1 ? mechanics[0] : "Multiple — see assets",
          promotion_channel: group.channels.size === 1 ? [...group.channels][0] : null,
          start_date: group.starts.sort()[0] ?? null,
          end_date: group.ends.sort().slice(-1)[0] ?? null,
          source_file: fileBase,
          source_sheet: brief.sheetName,
        });
        result.activitiesCreated++;
      }

      // Backfill the brief's own brand when every asset agreed on one brand
      // that the brief-level header text itself didn't name.
      if (!brandId) {
        const unique = [...new Set(assetBrandIds.filter((b): b is string => !!b))];
        if (unique.length === 1) updateBriefBrand.run(unique[0], briefId);
      }
    }
  });
  tx();

  result.brandsCreated = brandIndex.length - brandCountBefore;
  return result;
}

export function importDesignBriefWorkbook(db: Database.Database, filePath: string): DesignBriefImportResult {
  return writeParsedWorkbook(db, parseDesignBriefWorkbook(filePath));
}

export function importDesignBriefBuffer(db: Database.Database, buffer: Buffer, fileName: string): DesignBriefImportResult {
  return writeParsedWorkbook(db, parseDesignBriefWorkbookBuffer(buffer, fileName));
}
