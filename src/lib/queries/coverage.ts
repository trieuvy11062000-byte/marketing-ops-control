import { getDb } from "../db/client";

export interface CoverageRow {
  sourceFile: string;
  sourceSheet: string;
  businessFunction: string;
  destination: string;
  status: "MAPPED" | "PARTIAL" | "NOT USED";
  reason?: string; // required when status is NOT USED or PARTIAL
}

const MARKETING_CALENDAR = "2026 LGD Marketing Calendar.xlsx";
const PROMO_MASTER = "Promotion Master File.xlsx";
const MONTHLY_PROMO_SEP = "SEP-26 MKT Monthly Promotion.xlsx";
const MONTHLY_PROMO_OCT = "OCT-26 MKT Monthly Promotion.xlsx";
const DEMO_PLAN = "MONTHLY DEMO OCT-26 Plan.xlsx";

/** Static inventory of every sheet found across all 5 source files, re-scanned
 *  2026-09-30. Record counts are filled in live from the database, not hardcoded,
 *  so this stays honest as the import evolves. */
const INVENTORY: CoverageRow[] = [
  // Marketing Calendar — mapped
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "A&P26", businessFunction: "Annual A&P budget/status by supplier", destination: "A&P Packages", status: "MAPPED" },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "RT Digital26", businessFunction: "Social posts + Retail email content calendar", destination: "Digital / Social, Digital / Email (Retail)", status: "MAPPED" },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Enew26", businessFunction: "Email/newsletter tracking + container arrivals", destination: "Digital / Email (Retail), Supply Signals", status: "MAPPED" },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Container+WS26", businessFunction: "Wholesale container tracking + digital dependency flags", destination: "Supply Signals, Digital / Email+Website (Wholesale+Retail)", status: "MAPPED" },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "DGTCalendar", businessFunction: "Branded Video content execution log", destination: "Digital / Video", status: "PARTIAL", reason: "Only the itemized Branded Video table (~18 rows) is mapped; the sheet also contains an unrelated weekly content-pillar mini-calendar grid with merged multi-line day cells that isn't safely parseable as itemized records." },

  // Marketing Calendar — not used
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "1 / 2 / 3 / 4 / 5 / 6", businessFunction: "Draft calendar/dashboard layouts", destination: "—", status: "NOT USED", reason: "Deprecated draft duplicates of the 2026 Calendar / Dashboard sheets." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Dashboard", businessFunction: "SOP reference text", destination: "—", status: "NOT USED", reason: "Reference documentation, not itemized records." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "A&P Expense", businessFunction: "Monthly expense ledger by category (POSM/Tasting/Digital)", destination: "—", status: "NOT USED", reason: "Found and populated, but not yet mapped — would enrich A&P delivery lines with agreed vs real-time expense; deferred." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "MKT Induction", businessFunction: "New-hire onboarding guide", destination: "—", status: "NOT USED", reason: "Reference documentation, not itemized records." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Demo26", businessFunction: "Weekly demo count matrix by brand/shop", destination: "—", status: "NOT USED", reason: "Aggregate count matrix, no itemized session records — itemized Demo sessions come from the Monthly Demo Plan file instead." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Digital26", businessFunction: "Social/website/paid-ads planning grid", destination: "—", status: "NOT USED", reason: "Unpopulated planning template — 0 real posts found under any platform column." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Enews", businessFunction: "Email/newsletter tracking (legacy)", destination: "—", status: "NOT USED", reason: "Overlaps with Enew26 (same fields, subset) — avoiding duplicate import rather than silently picking one." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Instore Link", businessFunction: "Shop contact/access links", destination: "—", status: "NOT USED", reason: "Reference links only, not dated operational records." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "OnlineSalesTracking", businessFunction: "Weekly online promo campaign codes by SKU (2,964 rows)", destination: "—", status: "NOT USED", reason: "Overlaps with already-imported Online Promotion channel data (W##-ONLINE sheets) — would need dedup logic against the promotions table before safely importing." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "DigitalCT26 (Old)", businessFunction: "Legacy content calendar", destination: "—", status: "NOT USED", reason: "Deprecated, superseded by RT Digital26." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "POSM Tracking", businessFunction: "POSM cost/dispatch tracker", destination: "—", status: "NOT USED", reason: "Template only — 0 populated records found." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Containers26", businessFunction: "Master container/ETA schedule", destination: "—", status: "NOT USED", reason: "Template only — 0 populated supplier rows found (Container+WS26 carries the real data)." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "2026 Calendar", businessFunction: "Holiday/campaign overview grid", destination: "—", status: "NOT USED", reason: "Multi-block merged-cell calendar grid, not itemized records; holidays aren't Leader control items." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "MKT Operation", businessFunction: "SOP/weekly rhythm rules", destination: "—", status: "NOT USED", reason: "Reference documentation (informed the app's control-logic design conceptually, not re-imported as records)." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "Defined Store", businessFunction: "Store profile/sizing reference", destination: "—", status: "NOT USED", reason: "Reference lookup table, not a dated operational record." },
  { sourceFile: MARKETING_CALENDAR, sourceSheet: "(previously seen, now absent) TVC26 / POSM26 / Banner26 / Demo Item26 / Demo Facilities / Seeding / Email+Web27 / Canva Link / POS Code", businessFunction: "TVC broadcast tracking, POSM cost tracking, website banners, demo SKU list, demo equipment, social seeding tactics, email/web planning, design links, shop contacts", destination: "—", status: "NOT USED", reason: "These sheets existed in an earlier version of this file (191MB/36 sheets) but are absent from the current saved version (170MB/25 sheets) — the file was being actively edited (Excel lock file present) when re-ingested 2026-09-30. Re-run import once the restructure is finalized." },

  // Promotion Master File
  { sourceFile: PROMO_MASTER, sourceSheet: "FULL / Draft / W39-* / W40-*", businessFunction: "In-store SKU promotion state (live/upcoming/weekly diffs)", destination: "Promotions (IN-STORE)", status: "PARTIAL", reason: "Only current+next week (W39, W40) weekly diffs imported, by design — importing all 40 weeks back to January would flood the risk engine with stale 'overdue' noise for already-closed weeks." },
  { sourceFile: PROMO_MASTER, sourceSheet: "disclaimer", businessFunction: "Instructional/legend text", destination: "—", status: "NOT USED", reason: "Reference text, not records." },

  // Monthly Promotion (SEP/OCT)
  { sourceFile: MONTHLY_PROMO_SEP, sourceSheet: "W39-ONLINE", businessFunction: "Online Retail/Wholesale promotion setup", destination: "Promotions (ONLINE-RETAIL, ONLINE-WHOLESALE)", status: "MAPPED" },
  { sourceFile: MONTHLY_PROMO_OCT, sourceSheet: "W40-ONLINE", businessFunction: "Online Retail/Wholesale promotion setup", destination: "Promotions (ONLINE-RETAIL, ONLINE-WHOLESALE)", status: "MAPPED" },
  {
    sourceFile: `${MONTHLY_PROMO_SEP} / ${MONTHLY_PROMO_OCT}`,
    sourceSheet: "All in / Campaign26 / MO-* / LM-* / LP-* / HOSAN / Clearance Sales / DD-* / Exceptional-W## / Volume Deal / Category Deal",
    businessFunction: "Monthly campaign container metadata (theme, requester, period)",
    destination: "—",
    status: "NOT USED",
    reason: "Campaign identity is already derived from Promotion Master File's own codes; 'All in' sheet found empty in both files. Theme/requester enrichment from these container sheets deferred as a nice-to-have, not core.",
  },

  // Demo Plan
  { sourceFile: DEMO_PLAN, sourceSheet: "Summary", businessFunction: "Weekly demo session schedule by shop", destination: "Deliverables (Demo)", status: "MAPPED" },
  { sourceFile: DEMO_PLAN, sourceSheet: "Supplier Tracker", businessFunction: "Agreed demo session commitments by supplier", destination: "A&P Delivery Lines (Tasting)", status: "MAPPED" },
  { sourceFile: DEMO_PLAN, sourceSheet: "List / Demo Calendar / Demo by Agency", businessFunction: "SKU list used in demo, shop×day grid, agency breakdown", destination: "—", status: "NOT USED", reason: "Redundant with Summary sheet for control purposes; SKU-level demo product list is a reference detail, not a control record." },
];

export interface CoverageSummary extends CoverageRow {
  records: number;
}

export function getDataCoverage(): CoverageSummary[] {
  const db = getDb();

  const bySheet = (table: string): Map<string, number> => {
    const rows = db.prepare(`SELECT source_sheet, COUNT(*) c FROM ${table} GROUP BY source_sheet`).all() as {
      source_sheet: string;
      c: number;
    }[];
    return new Map(rows.map((r) => [r.source_sheet, r.c]));
  };

  const tables = ["promotions", "deliverables", "digital_activities", "supply_signals", "ap_packages", "ap_delivery_lines"];
  const counts = new Map<string, number>();
  for (const t of tables) {
    for (const [sheet, c] of bySheet(t)) {
      counts.set(sheet, (counts.get(sheet) ?? 0) + c);
    }
  }

  return INVENTORY.map((row) => {
    // Sheets that map 1:1 by name; composite/renamed rows keep records at 0 (documented, not counted).
    const records = counts.get(row.sourceSheet) ?? 0;
    return { ...row, records };
  });
}

export function getCoverageTotals() {
  const rows = getDataCoverage();
  return {
    mapped: rows.filter((r) => r.status === "MAPPED").length,
    partial: rows.filter((r) => r.status === "PARTIAL").length,
    notUsed: rows.filter((r) => r.status === "NOT USED").length,
    totalRecords: rows.reduce((n, r) => n + r.records, 0),
  };
}
