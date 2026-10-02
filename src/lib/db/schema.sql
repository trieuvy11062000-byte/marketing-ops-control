-- Marketing Operations Control — schema
-- Architecture: BRAND -> CAMPAIGN (orchestration) -> connected operational modules
-- (PROMOTION, DEMO/POSM/TVC/DIGITAL deliverables) -> A&P PACKAGE (commercial
-- reconciliation layer, aggregates from the operational modules, never duplicates them).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS weeks (
  week_code TEXT PRIMARY KEY,        -- 'W40'
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  start_date TEXT NOT NULL,          -- ISO date, Friday (Longdan retail week)
  end_date TEXT NOT NULL,            -- ISO date, Thursday
  month TEXT NOT NULL,               -- 'October'
  quarter TEXT NOT NULL,             -- 'Q4'
  parity TEXT NOT NULL               -- 'ODD' | 'EVEN'
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_tag TEXT                    -- how we first learned this brand (sheet name)
);

-- CAMPAIGN: the orchestration parent. NOT a promotion, NOT an A&P record.
-- brand_id is nullable: many Longdan campaigns (Monthly, Clearance, storewide Golden
-- Week) span every brand at once rather than belonging to one brand.
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,               -- derived: {campaign_type}-{month_token}, e.g. "MO-Oct26"
  brand_id TEXT REFERENCES brands(id),
  name TEXT NOT NULL,
  campaign_type TEXT,                -- MO/GW/LP/LM/DD/Clearance/VolumeDeal/CategoryDeal/HOSAN
  activation_type TEXT NOT NULL DEFAULT 'TACTICAL_ACTIVATION', -- CORE_CAMPAIGN | COMMERCIAL_PROGRAMME | TACTICAL_ACTIVATION
  driver TEXT,                       -- CONTAINER | A&P | OVERSTOCK_BBD | OEM | CATEGORY_STRATEGY | BRAND_REQUEST | SEASONAL | MANAGEMENT_REQUEST | OTHER — only set when deterministically known, never guessed
  driver_note TEXT,                  -- short free-text source note, e.g. "BBD < 9M" — not a full sentence
  quarter TEXT,
  month TEXT,
  start_date TEXT,                   -- derived from earliest linked promotion/deliverable
  end_date TEXT,                     -- derived from latest linked promotion/deliverable
  status_override TEXT,              -- manual override (e.g. CANCELLED); status is otherwise computed from dates at read time
  commercial_value REAL,             -- only populated when source data actually has it
  internal_pic TEXT,
  external_contact TEXT,
  theme TEXT,
  source_files TEXT,                 -- JSON array of {file, sheet}
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PROMOTION: a commercial offer applied to one SKU on one channel. Distinct object
-- from Campaign. In-store and Online (Retail/Wholesale) are separate rows even for
-- the exact same SKU — never merged.
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  brand_id TEXT REFERENCES brands(id),
  campaign_id TEXT REFERENCES campaigns(id),
  sku_code TEXT,
  sku_name TEXT,
  channel TEXT NOT NULL,             -- IN-STORE | ONLINE-RETAIL | ONLINE-WHOLESALE | LAST MILE | OTHER
  customer_type TEXT,                -- Retail | Wholesale | (nullable)
  mechanic TEXT,                     -- e.g. "Buy 2 for £3.00", "20% Off"
  normal_price REAL,
  promotion_price REAL,
  discount_label TEXT,               -- raw discount text where price isn't numeric
  start_date TEXT,
  end_date TEXT,
  stores_platform TEXT,              -- 'All Shops' | shop codes | 'Retail Website' etc.
  status_override TEXT,              -- manual override; otherwise computed from dates
  stock_status TEXT,                 -- from source "In Stock (Y/N)" where available
  setup_status TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING | DONE
  audit_status TEXT NOT NULL DEFAULT 'PENDING',   -- PENDING | AUDITED
  week_code TEXT REFERENCES weeks(week_code),
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DELIVERABLE: operational execution units that are NOT promotions — Demo, POSM,
-- TVC, Digital, Fixture. campaign_id is nullable: most Demo sessions in the source
-- data aren't tied to one formal Campaign, and we do not invent that link.
CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  brand_id TEXT REFERENCES brands(id),
  workstream TEXT NOT NULL,          -- Retail/In-store | Digital | A&P | Project/Management
  subtype TEXT NOT NULL,             -- Demo | POSM | TVC | Banner | Enews | Social | Website | Email | ...
  sku_code TEXT,
  sku_name TEXT,
  location TEXT,                     -- shop/area for in-store items, e.g. "Longdan Maidstone"
  session_label TEXT,                -- time slot / ca, e.g. "11:30–15:00"
  pic_role TEXT,                     -- Retail Marketing | Digital Marketing | A&P Marketing
  raw_owner TEXT,                    -- individual name/team text found in source, kept for traceability only
  execution_date TEXT,
  execution_deadline TEXT,
  week_code TEXT REFERENCES weeks(week_code),
  evidence_required INTEGER NOT NULL DEFAULT 0,
  evidence_status TEXT,              -- N/A | PENDING | COMPLETE
  status TEXT NOT NULL DEFAULT 'NOT STARTED',
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Leader control tasks attach to operational deliverables (Demo, POSM, TVC, Digital).
-- Promotions carry their own setup_status/audit_status directly (see promotions
-- table) rather than spawning control tasks; A&P delivery lines carry their own
-- reported/evidence_status directly likewise.
CREATE TABLE IF NOT EXISTS control_tasks (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  leader_action TEXT NOT NULL,       -- Review | Audit | Validate | Approve | Verify | Follow Up | Escalate | Close
  title TEXT NOT NULL,               -- e.g. "Review & Approve Acecook Halloween TVC"
  control_date TEXT,                 -- deadline for the leader action
  week_code TEXT REFERENCES weeks(week_code),
  status TEXT NOT NULL DEFAULT 'NOT STARTED',
  risk_level TEXT NOT NULL DEFAULT 'GREEN', -- RED | AMBER | GREEN
  risk_reason TEXT,
  next_action TEXT,
  issue_blocker TEXT,
  external_commitment INTEGER NOT NULL DEFAULT 0,
  external_deadline TEXT,
  external_delivery_status TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A&P PACKAGE: the commercial commitment with a brand, distinct from Campaign and
-- from Promotion. Represents what was agreed/proposed, not a checklist.
CREATE TABLE IF NOT EXISTS ap_packages (
  id TEXT PRIMARY KEY,
  brand_id TEXT REFERENCES brands(id),
  name TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  total_value REAL,                  -- only populated when source data has it
  longdan_fund REAL,
  brand_investment REAL,
  status TEXT NOT NULL DEFAULT 'IN DELIVERY', -- IN DELIVERY | COMPLETED | AWAITING PROPOSAL
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A&P DELIVERY LINE: one contracted deliverable inside a package (Golden Week,
-- Tasting, Gondola, TVC, Email...). "delivered_quantity" is aggregated from the
-- connected operational module (link_subtype/link_brand_id/link_period), never
-- duplicated by hand.
CREATE TABLE IF NOT EXISTS ap_delivery_lines (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES ap_packages(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,    -- 'Tasting' | 'TVC' | 'Golden Week Campaign' | ...
  agreed_label TEXT,                 -- e.g. "10 Sessions", "1 Campaign" — source text, not always numeric
  agreed_quantity REAL,              -- nullable — only when source gives a real number
  agreed_value REAL,                 -- $ value, only when source has it
  delivered_quantity REAL,           -- computed by aggregation, nullable if no linked source
  evidence_status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | PARTIAL | COMPLETE
  reported INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | IN DELIVERY | DELIVERED
  source_module TEXT,                -- 'Demo' | 'A&P26' | ... — where delivered_quantity is aggregated from
  link_brand_id TEXT REFERENCES brands(id),
  link_subtype TEXT,                 -- subtype/deliverable_type to match when aggregating (e.g. 'Demo')
  period_start TEXT,
  period_end TEXT,
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DEAL TRACKER: what was agreed/discussed commercially with the supplier —
-- separate from execution delivery lines (ap_delivery_lines). Never merged:
-- a deal point is a negotiation/commercial fact, not a delivery record.
CREATE TABLE IF NOT EXISTS ap_deal_tracker (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES ap_packages(id) ON DELETE CASCADE,
  deal_point TEXT NOT NULL,
  deal_type TEXT,                    -- 'Invoice/Payment' | 'POSM Supply' | 'Product Confirmation' | 'Funding' | 'Commercial Commitment' | ...
  amount REAL,
  currency TEXT,
  pic TEXT,
  status TEXT NOT NULL DEFAULT 'DISCUSSED', -- AGREED | DISCUSSED | PENDING | WAITING
  discussion TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- REPORT / EVIDENCE: a Campaign Reporting Record collected progressively
-- during execution. Pulls + summarises execution data at read time — never
-- duplicates it. Only the report-level fields (deadline, period, comments) are
-- actually stored here.
CREATE TABLE IF NOT EXISTS ap_campaign_reports (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES ap_packages(id) ON DELETE CASCADE,
  report_deadline TEXT,
  applied_period_start TEXT,
  applied_period_end TEXT,
  comments TEXT,
  status TEXT NOT NULL DEFAULT 'COLLECTING', -- COLLECTING | SUBMITTED | REVISION REQUESTED | FINALISED
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SUPPLY SIGNAL: container/stock information that can drive Digital execution.
-- Not a campaign — an information dependency.
CREATE TABLE IF NOT EXISTS supply_signals (
  id TEXT PRIMARY KEY,
  signal_type TEXT NOT NULL DEFAULT 'CONTAINER', -- CONTAINER | NEW_ARRIVAL | STOCK_UPDATE | OOS | RESTOCK | ETA_CHANGE | OEM_ARRIVAL | OTHER
  supplier TEXT,
  container_no TEXT,
  product_label TEXT,                -- campaign/product name tied to this container, where present
  eta TEXT,
  location TEXT,
  note TEXT,
  status TEXT,
  channel_scope TEXT NOT NULL DEFAULT 'SHARED', -- RETAIL | WHOLESALE | SHARED
  week_code TEXT REFERENCES weeks(week_code),
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DIGITAL ACTIVITY: Social / Website / Email / Video execution records. A channel
-- layer that SUPPORTS a Campaign/Activation, Demo, or Supply Signal — never a
-- standalone campaign in its own right.
CREATE TABLE IF NOT EXISTS digital_activities (
  id TEXT PRIMARY KEY,
  subtype TEXT NOT NULL,             -- Social | Website | Email | Video
  channel_scope TEXT NOT NULL DEFAULT 'RETAIL', -- RETAIL | WHOLESALE | SHARED
  platform TEXT,                     -- Facebook | Instagram | TikTok | YouTube | (null for Email/Website)
  title TEXT NOT NULL,
  brand_id TEXT REFERENCES brands(id),
  campaign_id TEXT REFERENCES campaigns(id), -- "supports" link — nullable, never forced
  supply_signal_id TEXT REFERENCES supply_signals(id),
  driver TEXT,                       -- CONTAINER | CAMPAIGN | DEMO | A&P | PROMOTION | OTHER
  planned_date TEXT,
  post_date TEXT,
  status TEXT,                       -- raw source status text (Design/Publish/Live/Off/Posted...)
  pic_role TEXT,
  approval_status TEXT,
  evidence_status TEXT,
  week_code TEXT REFERENCES weeks(week_code),
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- QUICK TASK: personal operational memory for the Leader — small ad-hoc items that
-- don't yet belong to a formal Campaign/Activation/Brand/A&P package. Deliberately
-- simpler than control_tasks: no deliverable_id, no risk engine, capture-first.
-- User-generated (not import-derived) — never dropped/recreated by the import script.
CREATE TABLE IF NOT EXISTS quick_tasks (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  created_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | WAITING | DONE | CONVERTED
  priority TEXT,                      -- LOW | MEDIUM | HIGH — nullable, not forced
  pic TEXT,                           -- free text — who's responsible
  related_person TEXT,                -- free text — who to contact/reference (e.g. "Thy")
  brand_id TEXT REFERENCES brands(id),
  activation_id TEXT REFERENCES campaigns(id),
  related_record TEXT,                -- short free text, e.g. "POSM · Halloween"
  note TEXT,
  source TEXT NOT NULL DEFAULT 'MANUAL', -- MANUAL | QUICK_NOTE
  week_code TEXT REFERENCES weeks(week_code),
  converted_note TEXT,                -- short text describing what it converted into, if status = CONVERTED
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_quick_tasks_status ON quick_tasks(status);
CREATE INDEX IF NOT EXISTS idx_quick_tasks_due_date ON quick_tasks(due_date);

-- DESIGN BRIEF: one source sheet's campaign/activity-level design requirement
-- header (Campaign/Brand/Period/Deadline). A workbook usually contains several.
-- Never invented — campaign_id link is only set when it can be confidently matched
-- to an existing campaign via the same campaign-code grouping logic used elsewhere.
CREATE TABLE IF NOT EXISTS design_briefs (
  id TEXT PRIMARY KEY,
  campaign_name TEXT,
  brand_id TEXT REFERENCES brands(id),
  campaign_id TEXT REFERENCES campaigns(id),
  campaign_type TEXT,                -- Monthly Campaign | Golden Week | Double Date | Longdan Plus | Demo/Tasting | Brand Campaign | A&P Brand Activity | Gondola/Fixture | Promotion | Landing Page | Email/eNews | Other | NEEDS MAPPING
  theme TEXT,
  cuisine TEXT,
  period_start TEXT,
  period_end TEXT,
  design_deadline TEXT,
  submission_deadline TEXT,
  a_and_p TEXT,                      -- free-text brand/A&P owner note from source
  sheet_kind TEXT NOT NULL,          -- CAMPAIGN_BRIEF | LANDING_PAGE | DEMO_BRIEF | GONDOLA_FIXTURE | PROMOTION_LABEL_TAG | PROMOTION_LABEL_SKU | EMAIL_BRIEF | DEMO_OPERATIONAL_INFO | INTERNAL_REFERENCE | EMPTY_TEMPLATE | UNCLASSIFIED
  status TEXT NOT NULL DEFAULT 'IMPORTED', -- IMPORTED | EXCLUDED
  exclusion_reason TEXT,
  asset_count INTEGER NOT NULL DEFAULT 0,
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DESIGN ASSET: one distinct required design deliverable, post format-split and
-- post variant-split (see designBrief.ts). This is the primary Marketing Ops
-- checklist table for the Design Brief module.
CREATE TABLE IF NOT EXISTS design_assets (
  id TEXT PRIMARY KEY,
  design_brief_id TEXT NOT NULL REFERENCES design_briefs(id) ON DELETE CASCADE,
  brand_id TEXT REFERENCES brands(id),
  campaign_id TEXT REFERENCES campaigns(id),
  asset_type TEXT NOT NULL,          -- normalised: Wobbler | Shelf Strip | TVC | Website Banner — Desktop | ...
  variant_label TEXT,                -- product group / variant name, distinct from asset_type — never a Brand
  channel TEXT NOT NULL,             -- IN-STORE | DIGITAL | DEMO | EMAIL | WEBSITE | SOCIAL | FIXTURE/BRANDING | PROMOTION SUPPORT | OTHER
  channel_subtype TEXT,
  format_raw TEXT,                   -- original unsplit source text for this row/group
  headline TEXT,
  secondary_message TEXT,
  cta TEXT,
  content_raw TEXT NOT NULL DEFAULT '', -- full untouched content block — never rewritten
  promotion_mechanic TEXT,
  promotion_channel TEXT,            -- IN-STORE | ONLINE RETAIL | BULK/WHOLESALE | LAST MILE | OTHER | NEEDS MAPPING
  promotion_id TEXT REFERENCES promotions(id), -- cross-linked only when confidently matched
  promotion_conflict INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  design_deadline TEXT,
  branding_requirement TEXT,
  theme_ref TEXT,
  design_note TEXT,
  reusable_template INTEGER NOT NULL DEFAULT 0,
  fixture_parent TEXT,               -- e.g. "Dongwon Gondola" when this asset belongs to a fixture, not a standalone campaign
  possible_duplicate_of TEXT REFERENCES design_assets(id),
  -- Leader audit fields — control/audit checkpoints, distinct from the Designer's task.
  -- Default TO CHECK; never auto-completed by the importer.
  brief_complete TEXT NOT NULL DEFAULT 'TO CHECK',
  sku_complete TEXT NOT NULL DEFAULT 'TO CHECK',
  promotion_verified TEXT NOT NULL DEFAULT 'TO CHECK',
  timeline_verified TEXT NOT NULL DEFAULT 'TO CHECK',
  content_verified TEXT NOT NULL DEFAULT 'TO CHECK',
  branding_verified TEXT NOT NULL DEFAULT 'TO CHECK',
  design_output_received TEXT NOT NULL DEFAULT 'TO CHECK',
  final_output_audited TEXT NOT NULL DEFAULT 'TO CHECK',
  ready_to_publish TEXT NOT NULL DEFAULT 'TO CHECK',
  evidence_link TEXT,
  confidence TEXT NOT NULL DEFAULT 'HIGH', -- HIGH | NEEDS MAPPING | UNCLEAR
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DESIGN ASSET PRODUCT: relational SKU mapping — one asset can list many products
-- without multiplying design tasks (rule: 1 design, X products, not X designs).
CREATE TABLE IF NOT EXISTS design_asset_products (
  id TEXT PRIMARY KEY,
  design_asset_id TEXT NOT NULL REFERENCES design_assets(id) ON DELETE CASCADE,
  product_code TEXT,
  product_name TEXT,
  product_group TEXT,
  role_note TEXT,
  source_row_ref TEXT
);

CREATE INDEX IF NOT EXISTS idx_design_briefs_campaign ON design_briefs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_design_assets_brief ON design_assets(design_brief_id);
CREATE INDEX IF NOT EXISTS idx_design_assets_brand ON design_assets(brand_id);
CREATE INDEX IF NOT EXISTS idx_design_assets_campaign ON design_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_design_assets_channel ON design_assets(channel);
CREATE INDEX IF NOT EXISTS idx_design_asset_products_asset ON design_asset_products(design_asset_id);

-- DEMO WEEKLY REPORT: one consolidated Marketing Operations performance record per
-- completed demo week. Holds only report-stated figures (verbatim from the
-- evaluation narrative, for traceability) and report findings (Key Learning,
-- Executive Summary) — never a calculated metric. Calculated metrics (sessions
-- count, units sold, uplift, CVS rate...) are computed at read-time from
-- demo_session_performance, the same way Campaign/Promotion status is computed
-- from dates rather than stored.
CREATE TABLE IF NOT EXISTS demo_weekly_reports (
  id TEXT PRIMARY KEY,                -- week_code, e.g. 'W39'
  week_code TEXT NOT NULL REFERENCES weeks(week_code),
  reported_units_sold INTEGER,        -- verbatim headline figure from the evaluation report/deck
  reported_uplift REAL,
  reported_foc INTEGER,
  reported_sessions INTEGER,
  reported_stores INTEGER,
  reported_brands INTEGER,
  key_learning TEXT,                  -- verbatim bullets extracted from the evaluation's Key Insights section
  executive_summary TEXT,             -- verbatim Executive Summary section text
  status TEXT NOT NULL DEFAULT 'IMPORTED',
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DEMO SESSION PERFORMANCE: one row per session x SKU — the finest-grain source
-- record and the basis for every calculated metric. Session-level fields
-- (estimated participants/interested, demo type, customer reaction, staff
-- feedback, modelled participant baseline) are repeated per SKU row exactly as
-- the evaluation report itself repeats them — never invented, only carried down
-- from the session's own first row per the source tracker's layout.
CREATE TABLE IF NOT EXISTS demo_session_performance (
  id TEXT PRIMARY KEY,
  demo_weekly_report_id TEXT NOT NULL REFERENCES demo_weekly_reports(id) ON DELETE CASCADE,
  deliverable_id TEXT REFERENCES deliverables(id),   -- linked Demo session — created if not already present, never duplicated
  week_code TEXT NOT NULL,
  location TEXT NOT NULL,             -- normalised store name
  session_label TEXT,                 -- time slot
  demo_date TEXT,
  brand_id TEXT REFERENCES brands(id),
  brand_name_raw TEXT,                -- source text before brand matching, kept for traceability
  sku_code TEXT,
  sku_name TEXT,
  promotion_mechanic TEXT,
  promotion_id TEXT REFERENCES promotions(id),  -- cross-linked only when confidently matched, never duplicated
  demo_type TEXT,                     -- Cooking Sampling | Snack Sampling | Alcohol Sampling | ...
  operated_by TEXT,
  -- SESSION-LEVEL fields (same value repeated across every SKU row in the session)
  estimated_participants REAL,
  estimated_interested REAL,
  customer_reaction TEXT,
  staff_feedback TEXT,
  estimated_participants_from_invoices REAL,   -- modelled CVS-rate denominator, per the source tracker's own methodology
  -- PER-SKU fields
  foc_quantity REAL,
  actual_sales_demo_day REAL,         -- DEMO-DAY SALES — units sold on the demo date itself
  sales_week_before REAL,             -- reference window — NOT demo sales, kept separately labelled
  sales_demo_week REAL,               -- DEMO-WEEK SALES — full week, NOT the same as demo-day sales
  avg_weekly_sales_baseline REAL,     -- HISTORICAL BASELINE — 6-month average weekly sales
  sales_6mo_total REAL,
  sales_1mo_total REAL,
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  source_row_ref TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DEMO WEEKLY ACTION: START / STOP / CONTINUE items, verbatim from the evaluation
-- deck/report — never generated or inferred by the app itself.
CREATE TABLE IF NOT EXISTS demo_weekly_actions (
  id TEXT PRIMARY KEY,
  demo_weekly_report_id TEXT NOT NULL REFERENCES demo_weekly_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL,             -- START | STOP | CONTINUE
  title TEXT NOT NULL,
  description TEXT,
  evidence TEXT,
  source_file TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- DEMO WEEKLY NOTE: user-generated operational context (rule: capture-first,
-- never overwrite source report findings). User-generated like quick_tasks —
-- never touched, wiped or regenerated by re-import.
CREATE TABLE IF NOT EXISTS demo_weekly_notes (
  id TEXT PRIMARY KEY,
  week_code TEXT NOT NULL REFERENCES weeks(week_code),
  note TEXT NOT NULL,
  category TEXT,                      -- free text, e.g. "Delivery Problem", "Product OOS", "FOC Allocation Issue"
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DEMO WEEKLY SOURCE: traceability — every report remains linked to the exact
-- files it was built from, with full extracted text preserved for search.
CREATE TABLE IF NOT EXISTS demo_weekly_sources (
  id TEXT PRIMARY KEY,
  demo_weekly_report_id TEXT NOT NULL REFERENCES demo_weekly_reports(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  source_type TEXT NOT NULL,          -- DEMO_RECORD_EXCEL | POST_EVENT_EVALUATION_DOCX | POST_EVENT_EVALUATION_PDF | SUMMARY | SUPPORTING
  extracted_text TEXT,                -- full narrative text, nullable for structured (xlsx) sources
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_demo_session_perf_report ON demo_session_performance(demo_weekly_report_id);
CREATE INDEX IF NOT EXISTS idx_demo_session_perf_brand ON demo_session_performance(brand_id);
CREATE INDEX IF NOT EXISTS idx_demo_session_perf_week ON demo_session_performance(week_code);
CREATE INDEX IF NOT EXISTS idx_demo_session_perf_deliverable ON demo_session_performance(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_demo_weekly_actions_report ON demo_weekly_actions(demo_weekly_report_id);
CREATE INDEX IF NOT EXISTS idx_demo_weekly_notes_week ON demo_weekly_notes(week_code);
CREATE INDEX IF NOT EXISTS idx_demo_weekly_sources_report ON demo_weekly_sources(demo_weekly_report_id);

-- ── MASTER DATA: Portfolio / Category / Month Ledger / Activity ────────────
-- Permanent hierarchy: Supplier/Portfolio -> Brand <-> Category -> SKU, and
-- Month -> Brand -> Activity -> Deliverable/Asset -> Product/SKU. These are
-- separate entities, never flattened into Brand or Campaign (see design
-- notes in designBrief.ts / designBriefImport.ts for the detection logic).

-- PORTFOLIO / SUPPLIER: a commercial/distribution grouping (e.g. "KFood")
-- that contains many Brands. Never itself a Brand, Category or Campaign.
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_tag TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CATEGORY: a product classification (e.g. "Drinks", "Instant Noodles").
-- A Brand can belong to multiple Categories via brand_categories.
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brand_categories (
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (brand_id, category_id)
);

-- MONTH LEDGER: the control layer marketing work is organised by. Never
-- hard-coded — created/updated automatically from whichever month an import
-- belongs to (e.g. "OCT-26 Design Brief.xlsx" -> October 2026).
CREATE TABLE IF NOT EXISTS months (
  id TEXT PRIMARY KEY,              -- 'M-2026-10'
  year INTEGER NOT NULL,
  month_number INTEGER NOT NULL,    -- 1-12
  month_label TEXT NOT NULL,        -- 'October 2026'
  status TEXT NOT NULL DEFAULT 'IMPORTED',
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DESIGN ACTIVITY: the parent of one or more Design Assets sharing the same
-- Brand + Activity Type + Activity Label within one brief (e.g. Wobbler +
-- Shelf Strip both belong to ONE "In-store Promotion" activity for Dongwon).
-- Activity != Asset — see designBriefActivity.ts for the taxonomy classifier.
CREATE TABLE IF NOT EXISTS design_activities (
  id TEXT PRIMARY KEY,
  month_id TEXT REFERENCES months(id),
  design_brief_id TEXT NOT NULL REFERENCES design_briefs(id) ON DELETE CASCADE,
  brand_id TEXT REFERENCES brands(id),
  portfolio_id TEXT REFERENCES portfolios(id),
  campaign_id TEXT REFERENCES campaigns(id),    -- linked orchestration campaign where matched, never duplicated
  activity_type TEXT NOT NULL,       -- CAMPAIGN | PROMOTION | IN-STORE | DIGITAL | A&P | OTHER
  activity_label TEXT NOT NULL,      -- e.g. "In-store Promotion", "Golden Week", "Demo / Tasting"
  promotion_mechanic TEXT,
  promotion_channel TEXT,
  start_date TEXT,
  end_date TEXT,
  source_file TEXT NOT NULL,
  source_sheet TEXT NOT NULL,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_design_activities_month ON design_activities(month_id);
CREATE INDEX IF NOT EXISTS idx_design_activities_brand ON design_activities(brand_id);
CREATE INDEX IF NOT EXISTS idx_design_activities_brief ON design_activities(design_brief_id);
CREATE INDEX IF NOT EXISTS idx_brand_categories_category ON brand_categories(category_id);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  campaigns_created INTEGER NOT NULL DEFAULT 0,
  campaigns_matched INTEGER NOT NULL DEFAULT 0,
  deliverables_created INTEGER NOT NULL DEFAULT 0,
  conflicts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETE'
);

CREATE INDEX IF NOT EXISTS idx_deliverables_campaign ON deliverables(campaign_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_week ON deliverables(week_code);
CREATE INDEX IF NOT EXISTS idx_deliverables_workstream ON deliverables(workstream);
CREATE INDEX IF NOT EXISTS idx_promotions_campaign ON promotions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promotions_brand ON promotions(brand_id);
CREATE INDEX IF NOT EXISTS idx_promotions_channel ON promotions(channel);
CREATE INDEX IF NOT EXISTS idx_promotions_sku ON promotions(sku_code);
CREATE INDEX IF NOT EXISTS idx_control_tasks_deliverable ON control_tasks(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_control_tasks_week ON control_tasks(week_code);
CREATE INDEX IF NOT EXISTS idx_control_tasks_status ON control_tasks(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_ap_delivery_lines_package ON ap_delivery_lines(package_id);
CREATE INDEX IF NOT EXISTS idx_digital_subtype ON digital_activities(subtype);
CREATE INDEX IF NOT EXISTS idx_digital_week ON digital_activities(week_code);
CREATE INDEX IF NOT EXISTS idx_digital_campaign ON digital_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_supply_signals_week ON supply_signals(week_code);

-- ── Master Knowledge Base ───────────────────────────────────────────────────
-- Stable business knowledge — rules, rate cards, working methods. NOT live
-- execution data (that stays in campaigns/promotions/design_assets/ap_*).
-- Every record carries year/effective_period/source/status so a 2027 rate
-- change never silently overwrites the 2026 record — the old one becomes
-- HISTORICAL and the new one becomes CURRENT. status can also be
-- 'NEEDS VERIFICATION' when source information conflicts or is incomplete —
-- never silently reconciled.

-- 1. Services & Rate Card
CREATE TABLE IF NOT EXISTS master_services (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,         -- 'CAMPAIGN MARKETING' | 'IN-STORE VISIBILITY' | 'ACTIVATION & DEMONSTRATION' | 'DIGITAL MARKETING' | 'PREMIUM PACKAGES' | 'POSM & BRAND ACTIVATION' | 'VOLUME DISCOUNT'
  service_name TEXT NOT NULL,
  package TEXT,                   -- e.g. 'Basic' | 'Premium' | 'Diamond' — null when the service has no package tier
  description TEXT,
  price_gbp TEXT,                 -- kept as text: source has ranges ("£1,500–£2,500") not just single values
  price_usd TEXT,
  price_eur TEXT,
  duration TEXT,
  store_coverage TEXT,
  channel TEXT,
  coverage_raw TEXT,               -- full source coverage string, verbatim — duration/store_coverage/channel are a best-effort split of this
  notes TEXT,
  year INTEGER NOT NULL,          -- 2026 | 2027
  effective_period TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',   -- CURRENT | HISTORICAL | NEEDS VERIFICATION
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_master_services_year ON master_services(year);
CREATE INDEX IF NOT EXISTS idx_master_services_category ON master_services(category);

-- Coverage term vocabulary (Duration / Store Coverage / Channel / Frequency) —
-- the definitions behind the rate card's coverage columns.
CREATE TABLE IF NOT EXISTS master_coverage_terms (
  id TEXT PRIMARY KEY,
  term_type TEXT NOT NULL,        -- 'Duration' | 'Store Coverage' | 'Channel / Market' | 'Frequency'
  term_value TEXT NOT NULL,
  year INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 2. Campaign Knowledge — the Longdan campaign taxonomy and timing rules.
CREATE TABLE IF NOT EXISTS master_campaign_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,             -- 'Monthly Campaign' | 'Golden Week' | ...
  what_it_is TEXT,
  frequency TEXT,
  timing_rule TEXT,
  duration TEXT,
  purpose TEXT,
  typical_deliverables TEXT,
  notes TEXT,
  year INTEGER NOT NULL,
  effective_period TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_master_campaign_types_year ON master_campaign_types(year);

-- 3. Annual Campaign Calendar — reference knowledge (the planned calendar
-- structure), kept separate from live Campaign execution records.
CREATE TABLE IF NOT EXISTS master_calendar_months (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month_number INTEGER NOT NULL,  -- 1-12
  theme TEXT,
  campaign_type TEXT,
  campaign_name TEXT,
  planning_date TEXT,
  start_date TEXT,
  end_date TEXT,
  hero_category TEXT,
  special_dates TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_master_calendar_year ON master_calendar_months(year, month_number);

-- 4. A&P Proposal Playbook — the proposal-building workflow + standing rules.
CREATE TABLE IF NOT EXISTS master_ap_playbook_steps (
  id TEXT PRIMARY KEY,
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,        -- 'Brief' | 'Verify Data' | 'Select Activities' | 'Build Budget' | 'Forecast' | 'Build Proposal' | 'Final QA'
  description TEXT,
  rules TEXT,                     -- newline-separated standing rules relevant to this step
  source TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS master_ap_checklist_items (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  item TEXT NOT NULL
);

-- 5. Marketing Operations Handbook — recurring working knowledge referenced by
-- other modules (In-store, Demo, Digital, A&P reporting, Design Brief rules...).
CREATE TABLE IF NOT EXISTS master_handbook_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,         -- 'In-store workflow' | 'Demo workflow' | 'POSM workflow' | 'TVC workflow' | 'Digital workflow' | 'Email workflow' | 'Website workflow' | 'Promotion workflow' | 'A&P reporting workflow' | 'Design brief interpretation rules' | 'Reporting standards'
  title TEXT NOT NULL,
  body TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_master_handbook_category ON master_handbook_entries(category);

-- Team working rules — WHO does WHAT, WHEN, and HANDS OFF TO WHOM. One row per
-- PIC/workstream. Never invented: a field with no supplied source stays NULL
-- and the record's status is NEEDS VERIFICATION rather than guessed content.
CREATE TABLE IF NOT EXISTS master_workstreams (
  id TEXT PRIMARY KEY,
  pic_name TEXT NOT NULL,          -- PIC / Workstream name
  recurring_tasks TEXT,
  recurring_tasks_vi TEXT,
  weekly_timing TEXT,               -- e.g. "Tue -> collect info\nWed -> finalise ePOS\n..."
  weekly_timing_vi TEXT,
  input_needed TEXT,
  input_needed_vi TEXT,
  my_action TEXT,
  my_action_vi TEXT,
  handover_to TEXT,
  handover_to_vi TEXT,
  deadline TEXT,
  deadline_vi TEXT,
  output TEXT,
  output_vi TEXT,
  check_audit TEXT,
  check_audit_vi TEXT,
  important_rules TEXT,
  important_rules_vi TEXT,
  execution_detail TEXT,            -- reference tables: channel cadence, platform strategy, deliverables — supplementary to important_rules
  execution_detail_vi TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',   -- CURRENT | NEEDS VERIFICATION
  source TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Projects — project control system ────────────────────────────────────────
-- A PROJECT is a large, cross-team initiative (tender, sponsorship, proposal,
-- event, supplier-funded programme) — distinct from a Campaign/Activity, which
-- is one execution record. A Project can reference many Campaigns/Demo/Digital/
-- In-store/A&P records as its Workstreams, but never duplicates their data.
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_type TEXT NOT NULL,        -- Tender | Sponsorship | Proposal | Event | Supplier-funded Programme | ...
  partner TEXT,
  funding_source TEXT,
  execution_company TEXT,
  period_start TEXT,
  period_end TEXT,
  current_stage TEXT,                -- Planning | Proposal | Submitted | Approved | Execution | Reporting | Claim | Completed | On Hold (free text — source phrasing kept verbatim)
  overall_status TEXT NOT NULL,      -- Planning | Proposal | Submitted | Approved | Execution | Reporting | Claim | Completed | Failed | On Hold
  failure_reason TEXT,               -- only set when overall_status = Failed — never cleared, kept as project history
  pic TEXT,
  summary TEXT,                      -- 3-5 line project summary, never the full document
  next_action TEXT,
  main_store_scope TEXT,
  main_product_focus TEXT,
  ap_package_id TEXT REFERENCES ap_packages(id),  -- link to A&P commercial record — never duplicated
  brand_id TEXT REFERENCES brands(id),
  source_file TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(overall_status);

-- Funding streams must never be merged (e.g. aT Korea funding vs Hosan-owned
-- funding on the same project stay as separate rows).
CREATE TABLE IF NOT EXISTS project_funding (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  funding_label TEXT NOT NULL,       -- 'aT Korea Funding' | 'Hosan-owned Funding — Ambient' | ...
  amount TEXT,                       -- kept as text — source gives "USD 26,531 ±5%" style values
  currency TEXT,
  flow TEXT,                         -- e.g. "aT Korea -> Hosan -> Longdan"
  contribution_note TEXT,            -- e.g. "Refund/Contribution: 10%"
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED | WORKING | TO CONFIRM
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_name TEXT NOT NULL,      -- Proposal | Approval | Preparation | Execution | Evidence | Report | Claim
  deadline TEXT,
  owner TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED | IN PROGRESS | DONE | AT RISK
  dependency TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Project hierarchy: PROJECT -> Funding / Stock / Campaign / Demo / POSM /
-- Digital / Event / Design / Evidence / Invoice / Report / Claim. A workstream
-- can optionally link to a real execution record (campaign/brand) instead of
-- duplicating its data.
CREATE TABLE IF NOT EXISTS project_workstreams (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workstream_name TEXT NOT NULL,     -- 'Funding' | 'Stock / Logistics' | 'Campaign' | 'In-store' | 'Demo' | 'POSM' | 'Evidence' | 'Invoice' | 'Report / Claim' | ...
  detail TEXT,                       -- short descriptor, e.g. "Branded Shelf Line"
  status TEXT NOT NULL DEFAULT 'PLANNED',
  linked_campaign_id TEXT REFERENCES campaigns(id),
  linked_brand_id TEXT REFERENCES brands(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Versioned project facts. A new version is a NEW row (status CURRENT) — the
-- old row's status flips to SUPERSEDED. Never merged/overwritten, so project
-- history is never lost (see rule 7: Information Status + Decision Log).
CREATE TABLE IF NOT EXISTS project_information (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,            -- 'Demo Schedule' | 'Golden Week' | 'Shelf Line' | 'Funding' | ...
  label TEXT NOT NULL,               -- short value, e.g. "12 Oct + 24 Nov = 36 sessions"
  detail TEXT,                       -- longer explanation
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED | WORKING | TO CONFIRM | SUPERSEDED | CANCELLED
  effective_date TEXT,
  source TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_project_information_project ON project_information(project_id, category);

-- Tabular demo product lists, grouped by month/week in the UI via month_label/week_label.
CREATE TABLE IF NOT EXISTS project_demo_products (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  month_label TEXT NOT NULL,         -- 'October' | 'November'
  week_label TEXT,                   -- 'W43' | null
  product_code TEXT,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED | TO CONFIRM | CONFIRMED
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_posm_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  posm_type TEXT NOT NULL,
  quantity_scope TEXT,
  status TEXT NOT NULL DEFAULT 'AGREED',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_cooking_guidelines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Project Action Control — the daily-follow table.
CREATE TABLE IF NOT EXISTS project_actions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  workstream TEXT,
  owner TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED | URGENT | WAITING | TO CONFIRM | IN PROGRESS | DONE
  dependency TEXT,
  latest_update TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Active issues only — never generic/AI-generated risk filler.
CREATE TABLE IF NOT EXISTS project_risks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Generic collapsible detail blocks: Budget Breakdown, Product/SKU List, POSM
-- Breakdown, Logistics/Container, Evidence Requirements, Proposal Versions,
-- Meeting Notes, Additional Information, Original Proposal Scope...
CREATE TABLE IF NOT EXISTS project_detail_sections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Campaign Knowledge / Rules — operational SOPs and lookup procedures for
-- running campaigns/promotions day to day (Weekly Promotion Update, Force
-- De-active, Demo/Tasting Checklist, Website Banner reference...). Distinct
-- from master_campaign_types (the campaign TAXONOMY/timing rules) — this
-- table holds the step-by-step HOW, displayed the same way as Team
-- Workstreams: collapsed row, click to expand full procedure.
CREATE TABLE IF NOT EXISTS master_campaign_rules (
  id TEXT PRIMARY KEY,
  rule_name TEXT NOT NULL,
  category TEXT NOT NULL,          -- 'Promotion Procedure' | 'Demo Procedure' | 'Digital Reference' | ...
  summary TEXT,                    -- one-line teaser shown in the collapsed row
  body TEXT,
  body_vi TEXT,
  status TEXT NOT NULL DEFAULT 'CURRENT',  -- CURRENT | HISTORICAL | NEEDS VERIFICATION
  source TEXT,
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
