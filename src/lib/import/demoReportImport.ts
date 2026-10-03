import type Database from "better-sqlite3";
import { upsertBrand, upsertDeliverable } from "../db/repo";
import { generateExecutiveSummaryBullets } from "../queries/demoReports";
import { slugify } from "./utils";
import {
  readWorkbook,
  sheetToRows,
  detectWeekFromWorkbook,
  parseDemoPerformanceSheet,
  parseDemoSummarySheet,
  type DemoPerformanceRow,
} from "./demoReportXlsx";
import {
  extractDocxParagraphs,
  extractPdfPages,
  extractStartStopContinue,
  condenseAction,
  consolidateActions,
  detectWeekFromText,
  type CondensedAction,
} from "./demoReportNarrative";

export interface UploadedFile {
  name: string;
  buffer: Buffer;
}

export type DemoSourceType = "DEMO_RECORD_EXCEL" | "POST_EVENT_EVALUATION_DOCX" | "POST_EVENT_EVALUATION_PDF" | "SUMMARY" | "SUPPORTING";

function classifyFile(name: string): DemoSourceType {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") return "DEMO_RECORD_EXCEL";
  if (ext === "docx" || ext === "doc") return "POST_EVENT_EVALUATION_DOCX";
  if (ext === "pdf") return "POST_EVENT_EVALUATION_PDF";
  return "SUPPORTING";
}

function extractReportedKpis(pages: string[]): {
  uplift: number | null; units: number | null; foc: number | null;
  stores: number | null; sessions: number | null; brands: number | null;
} {
  const page = pages.find((p) => /sales uplift/i.test(p) && /units sold/i.test(p) && /foc/i.test(p)) ?? pages[1] ?? pages[0] ?? "";
  const flat = page.replace(/\s+/g, " ");
  const num = (re: RegExp) => { const m = flat.match(re); return m ? Number(m[1]) : null; };
  return {
    uplift: num(/(\d+(?:\.\d+)?)x\s*sales uplift/i),
    units: num(/(\d+)\s*units sold/i),
    foc: num(/(\d+)\s*foc samples/i),
    stores: num(/(\d+)\s+stores?\b/i),
    sessions: num(/(\d+)\s+sessions?\b/i),
    brands: num(/(\d+)\s+brands?\b/i),
  };
}

const SKU_CODE_RE = /^\d{3,9}$/;

/** Best-effort promotion cross-link — only for a confidently-matched SKU/channel/
 *  week combination. Never creates or duplicates a Promotion record. */
function matchPromotion(db: Database.Database, skuCode: string | null, weekCode: string): string | null {
  if (!skuCode || !SKU_CODE_RE.test(skuCode)) return null;
  const row = db
    .prepare("SELECT id FROM promotions WHERE sku_code = ? AND week_code = ? AND channel = 'IN-STORE' LIMIT 1")
    .get(skuCode, weekCode) as { id: string } | undefined;
  return row?.id ?? null;
}

export interface DemoReportImportResult {
  weekCode: string | null;
  sessionsCreated: number;
  performanceRowsWritten: number;
  brandsLinked: number;
  actionsWritten: number;
  sourcesWritten: number;
  warnings: string[];
}

/** Multi-file Weekly Demo Report import — the permanent, reusable pipeline.
 *  Upload → Detect Week → Match/Create Demo Sessions → Extract Performance →
 *  Extract Brand/SKU/Promotion → Extract START/STOP/CONTINUE → Attach Source →
 *  Create/Update ONE Weekly Demo Report. Re-uploading a file for the same week
 *  reconciles (re-writes only that file's rows) rather than duplicating. */
export async function importDemoReportFiles(db: Database.Database, files: UploadedFile[]): Promise<DemoReportImportResult> {
  const warnings: string[] = [];

  const xlsxFiles = files.filter((f) => classifyFile(f.name) === "DEMO_RECORD_EXCEL");
  const docxFiles = files.filter((f) => classifyFile(f.name) === "POST_EVENT_EVALUATION_DOCX");
  const pdfFiles = files.filter((f) => classifyFile(f.name) === "POST_EVENT_EVALUATION_PDF");
  const supportingFiles = files.filter((f) => classifyFile(f.name) === "SUPPORTING");

  // ── 1. Detect week ──────────────────────────────────────────────────────
  let weekCode: string | null = null;
  for (const f of files) weekCode = weekCode ?? detectWeekFromText(f.name);

  const workbooks = xlsxFiles.map((f) => ({ file: f, wb: readWorkbook(f.buffer) }));
  if (!weekCode) {
    for (const { wb } of workbooks) weekCode = weekCode ?? detectWeekFromWorkbook(wb);
  }
  if (!weekCode) {
    return {
      weekCode: null, sessionsCreated: 0, performanceRowsWritten: 0, brandsLinked: 0, actionsWritten: 0, sourcesWritten: 0,
      warnings: ["Could not detect a week code from any provided file — import aborted. Name the file starting with the week code (e.g. W39_...) or ensure its content says 'WEEK 39'."],
    };
  }

  const weekRow = db.prepare("SELECT week_code FROM weeks WHERE week_code = ?").get(weekCode) as { week_code: string } | undefined;
  if (!weekRow) warnings.push(`Week ${weekCode} is not in the weeks reference table — report saved but week-based views may not show it.`);

  // ── 2. XLSX: performance + schedule ──────────────────────────────────────
  const allPerfRows: { row: DemoPerformanceRow; sourceFile: string }[] = [];
  const scheduleTheme = new Map<string, string>();

  for (const { file, wb } of workbooks) {
    const perfSheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === weekCode!.toUpperCase()) ?? wb.SheetNames.find((n) => detectWeekFromText(n) === weekCode);
    if (perfSheetName) {
      const rows = parseDemoPerformanceSheet(sheetToRows(wb, perfSheetName), perfSheetName);
      for (const row of rows) {
        allPerfRows.push({ row, sourceFile: file.name });
        if (row.theme) scheduleTheme.set(`${row.location}__${row.sessionLabel}`, row.theme);
      }
    } else {
      warnings.push(`No sheet matching ${weekCode} found in ${file.name}.`);
    }

    const summarySheetName = wb.SheetNames.find((n) => /^summary$/i.test(n.trim()));
    if (summarySheetName) {
      const schedRows = parseDemoSummarySheet(sheetToRows(wb, summarySheetName), summarySheetName);
      for (const s of schedRows) if (s.theme) scheduleTheme.set(`${s.location}__${s.sessionLabel}`, s.theme);
    }
  }
  if (allPerfRows.length === 0) {
    warnings.push(`No demo performance rows were extracted for ${weekCode}. Check for a sheet named "${weekCode}" with the standard Shop/Time/Brand/Code layout.`);
  }

  // ── 3. Narrative: docx + pdf ─────────────────────────────────────────────
  // The full evaluation narrative is preserved verbatim in demo_weekly_sources
  // (for traceability/search) but is never imported into Executive Summary or
  // START/STOP/CONTINUE — those are short, operational, and either generated
  // from calculated performance data (Executive Summary) or condensed to one
  // sentence each (actions). See generateExecutiveSummaryBullets / condenseAction.
  const sourceTexts: { fileName: string; type: DemoSourceType; text: string | null }[] = [];

  for (const f of docxFiles) {
    const paragraphs = await extractDocxParagraphs(f.buffer);
    sourceTexts.push({ fileName: f.name, type: "POST_EVENT_EVALUATION_DOCX", text: paragraphs.join("\n") });
  }

  // Known brand/store names for this week — used to detect which brand/store
  // each action card refers to so it can be condensed to "Brand @ Store — action".
  const knownBrands = [...new Set(allPerfRows.map((r) => r.row.brandRaw).filter(Boolean))];
  const knownStores = [...new Set(allPerfRows.map((r) => r.row.location.replace(/^lgd\s+/i, "").trim()))];
  const storeToBrand = new Map<string, string>();
  for (const { row } of allPerfRows) {
    const store = row.location.replace(/^lgd\s+/i, "").trim();
    if (row.brandRaw && !storeToBrand.has(store)) storeToBrand.set(store, row.brandRaw);
  }

  const actions: (CondensedAction & { sourceFile: string })[] = [];
  let reportedKpis = { uplift: null as number | null, units: null as number | null, foc: null as number | null, stores: null as number | null, sessions: null as number | null, brands: null as number | null };

  for (const f of pdfFiles) {
    const pages = await extractPdfPages(f.buffer);
    const found = extractStartStopContinue(pages);
    const condensed = consolidateActions(found.map((a) => condenseAction(a, knownBrands, knownStores, storeToBrand)));
    for (const a of condensed) actions.push({ ...a, sourceFile: f.name });
    if (found.length === 0) warnings.push(`${f.name}: no START/STOP/CONTINUE slide found — no actions extracted from this file.`);
    reportedKpis = extractReportedKpis(pages);
    sourceTexts.push({ fileName: f.name, type: "POST_EVENT_EVALUATION_PDF", text: pages.join("\n\n") });
  }

  for (const f of xlsxFiles) sourceTexts.push({ fileName: f.name, type: "DEMO_RECORD_EXCEL", text: null });
  for (const f of supportingFiles) sourceTexts.push({ fileName: f.name, type: "SUPPORTING", text: null });

  // ── 4. Write to DB (transaction) ─────────────────────────────────────────
  const brandIds = new Set<string>();
  let sessionsCreated = 0;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO demo_weekly_reports (id, week_code, reported_units_sold, reported_uplift, reported_foc,
          reported_sessions, reported_stores, reported_brands, key_learning, executive_summary, status)
       VALUES (@id, @week_code, @reported_units_sold, @reported_uplift, @reported_foc,
          @reported_sessions, @reported_stores, @reported_brands, @key_learning, @executive_summary, 'IMPORTED')
       ON CONFLICT(id) DO UPDATE SET
         reported_units_sold = COALESCE(excluded.reported_units_sold, demo_weekly_reports.reported_units_sold),
         reported_uplift = COALESCE(excluded.reported_uplift, demo_weekly_reports.reported_uplift),
         reported_foc = COALESCE(excluded.reported_foc, demo_weekly_reports.reported_foc),
         reported_sessions = COALESCE(excluded.reported_sessions, demo_weekly_reports.reported_sessions),
         reported_stores = COALESCE(excluded.reported_stores, demo_weekly_reports.reported_stores),
         reported_brands = COALESCE(excluded.reported_brands, demo_weekly_reports.reported_brands),
         key_learning = COALESCE(excluded.key_learning, demo_weekly_reports.key_learning),
         executive_summary = COALESCE(excluded.executive_summary, demo_weekly_reports.executive_summary),
         last_updated = datetime('now')`
    ).run({
      id: weekCode, week_code: weekCode,
      reported_units_sold: reportedKpis.units, reported_uplift: reportedKpis.uplift, reported_foc: reportedKpis.foc,
      reported_sessions: reportedKpis.sessions, reported_stores: reportedKpis.stores, reported_brands: reportedKpis.brands,
      key_learning: null, executive_summary: null,
    });

    // Performance rows: reconcile per source file (delete-then-insert for that file only)
    const perfSourceFiles = [...new Set(allPerfRows.map((r) => r.sourceFile))];
    for (const sf of perfSourceFiles) {
      db.prepare("DELETE FROM demo_session_performance WHERE demo_weekly_report_id = ? AND source_file = ?").run(weekCode, sf);
    }

    const insertPerf = db.prepare(
      `INSERT INTO demo_session_performance (id, demo_weekly_report_id, deliverable_id, week_code, location,
          session_label, demo_date, brand_id, brand_name_raw, sku_code, sku_name, promotion_mechanic, promotion_id,
          demo_type, operated_by, estimated_participants, estimated_interested, customer_reaction, staff_feedback,
          estimated_participants_from_invoices, foc_quantity, actual_sales_demo_day, sales_week_before,
          sales_demo_week, avg_weekly_sales_baseline, sales_6mo_total, sales_1mo_total, source_file, source_sheet, source_row_ref)
       VALUES (@id, @demo_weekly_report_id, @deliverable_id, @week_code, @location,
          @session_label, @demo_date, @brand_id, @brand_name_raw, @sku_code, @sku_name, @promotion_mechanic, @promotion_id,
          @demo_type, @operated_by, @estimated_participants, @estimated_interested, @customer_reaction, @staff_feedback,
          @estimated_participants_from_invoices, @foc_quantity, @actual_sales_demo_day, @sales_week_before,
          @sales_demo_week, @avg_weekly_sales_baseline, @sales_6mo_total, @sales_1mo_total, @source_file, @source_sheet, @source_row_ref)`
    );

    const seenDeliverables = new Set<string>();
    let rowIdx = 0;
    for (const { row, sourceFile } of allPerfRows) {
      rowIdx++;
      const brandId = row.brandRaw ? upsertBrand(db, row.brandRaw, `${weekCode} Demo Report`) : null;
      if (brandId) brandIds.add(brandId);

      const theme = scheduleTheme.get(`${row.location}__${row.sessionLabel}`) ?? row.theme ?? row.demoType ?? "Demo";
      const deliverableId = `DEMO-${weekCode}__${slugify(row.location)}__${slugify(theme, row.sessionLabel)}`;
      if (!seenDeliverables.has(deliverableId)) {
        seenDeliverables.add(deliverableId);
        upsertDeliverable(db, {
          id: deliverableId,
          campaign_id: null,
          brand_id: brandId,
          workstream: "Retail/In-store",
          subtype: "Demo",
          sku_code: null,
          sku_name: theme,
          location: row.location,
          session_label: row.sessionLabel,
          pic_role: "Retail Marketing",
          raw_owner: row.operatedBy,
          execution_date: row.demoDate,
          execution_deadline: row.demoDate,
          week_code: weekCode,
          evidence_required: 1,
          evidence_status: "COMPLETE",
          status: "DELIVERED",
          source_file: sourceFile,
          source_sheet: weekCode!,
          source_row_ref: row.sourceRowRef,
        });
        sessionsCreated++;
      }

      const promotionId = matchPromotion(db, row.skuCode, weekCode!);

      insertPerf.run({
        id: `${weekCode}__PERF${rowIdx}`,
        demo_weekly_report_id: weekCode,
        deliverable_id: deliverableId,
        week_code: weekCode,
        location: row.location,
        session_label: row.sessionLabel,
        demo_date: row.demoDate,
        brand_id: brandId,
        brand_name_raw: row.brandRaw || null,
        sku_code: row.skuCode,
        sku_name: row.skuName,
        promotion_mechanic: row.promotionMechanic,
        promotion_id: promotionId,
        demo_type: row.demoType,
        operated_by: row.operatedBy,
        estimated_participants: row.estimatedParticipants,
        estimated_interested: row.estimatedInterested,
        customer_reaction: row.customerReaction,
        staff_feedback: row.staffFeedback,
        estimated_participants_from_invoices: row.estimatedParticipantsFromInvoices,
        foc_quantity: row.focQuantity,
        actual_sales_demo_day: row.actualSalesDemoDay,
        sales_week_before: row.salesWeekBefore,
        sales_demo_week: row.salesDemoWeek,
        avg_weekly_sales_baseline: row.avgWeeklySalesBaseline,
        sales_6mo_total: row.sales6moTotal,
        sales_1mo_total: row.sales1moTotal,
        source_file: sourceFile,
        source_sheet: weekCode!,
        source_row_ref: row.sourceRowRef,
      });
    }

    // Actions: reconcile per source file
    const actionSourceFiles = [...new Set(actions.map((a) => a.sourceFile))];
    for (const sf of actionSourceFiles) {
      db.prepare("DELETE FROM demo_weekly_actions WHERE demo_weekly_report_id = ? AND source_file = ?").run(weekCode, sf);
    }
    const insertAction = db.prepare(
      `INSERT INTO demo_weekly_actions (id, demo_weekly_report_id, category, title, description, evidence, source_file, sort_order)
       VALUES (@id, @demo_weekly_report_id, @category, @title, @description, @evidence, @source_file, @sort_order)`
    );
    actions.forEach((a, i) => {
      insertAction.run({
        id: `${weekCode}__ACT${i + 1}`,
        demo_weekly_report_id: weekCode,
        category: a.category,
        title: a.title,
        description: a.description || null,
        evidence: a.evidence,
        source_file: a.sourceFile,
        sort_order: i,
      });
    });

    // Sources: replace per file name (idempotent re-upload)
    const insertSource = db.prepare(
      `DELETE FROM demo_weekly_sources WHERE demo_weekly_report_id = ? AND file_name = ?`
    );
    const addSource = db.prepare(
      `INSERT INTO demo_weekly_sources (id, demo_weekly_report_id, file_name, source_type, extracted_text)
       VALUES (@id, @demo_weekly_report_id, @file_name, @source_type, @extracted_text)`
    );
    sourceTexts.forEach((s, i) => {
      insertSource.run(weekCode, s.fileName);
      addSource.run({
        id: `${weekCode}__SRC${i + 1}__${slugify(s.fileName)}`,
        demo_weekly_report_id: weekCode,
        file_name: s.fileName,
        source_type: s.type,
        extracted_text: s.text,
      });
    });
  });
  tx();

  // Generate the compact Executive Summary from the just-written performance
  // data (never from the narrative report) and store it.
  const executiveSummary = generateExecutiveSummaryBullets(weekCode);
  if (executiveSummary) {
    db.prepare("UPDATE demo_weekly_reports SET executive_summary = ?, last_updated = datetime('now') WHERE id = ?").run(executiveSummary, weekCode);
  }

  return {
    weekCode,
    sessionsCreated,
    performanceRowsWritten: allPerfRows.length,
    brandsLinked: brandIds.size,
    actionsWritten: actions.length,
    sourcesWritten: sourceTexts.length,
    warnings,
  };
}
