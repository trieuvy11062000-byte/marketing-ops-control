export type Workstream = "Retail/In-store" | "Digital" | "A&P" | "Project/Management";

export type PicRole =
  | "Retail Marketing"
  | "Digital Marketing"
  | "Promotion Marketing"
  | "A&P Marketing"
  | "Project Management";

export type LeaderAction =
  | "Review"
  | "Audit"
  | "Validate"
  | "Approve"
  | "Verify"
  | "Follow Up"
  | "Escalate"
  | "Close";

export type ControlStatus =
  | "NOT STARTED"
  | "IN PROGRESS"
  | "WAITING FOR OUTPUT"
  | "WAITING FOR LEADER REVIEW"
  | "CHANGES REQUIRED"
  | "APPROVED"
  | "BLOCKED"
  | "LIVE"
  | "EVIDENCE PENDING"
  | "DELIVERED"
  | "CLOSED";

export type RiskLevel = "RED" | "AMBER" | "GREEN";

export type PromotionChannel = "IN-STORE" | "ONLINE-RETAIL" | "ONLINE-WHOLESALE" | "LAST MILE" | "OTHER";

export interface Brand {
  id: string;
  name: string;
  source_tag: string | null;
  portfolio_id: string | null;
}

/** CAMPAIGN — the orchestration parent. Never a Promotion, never an A&P record.
 *  status is NOT stored: it's computed from start_date/end_date (see status.ts),
 *  with status_override for manual cases (e.g. CANCELLED). */
export type ActivationType = "CORE_CAMPAIGN" | "COMMERCIAL_PROGRAMME" | "TACTICAL_ACTIVATION";

export interface Campaign {
  id: string;
  brand_id: string | null;
  name: string;
  campaign_type: string | null;
  activation_type: ActivationType;
  driver: string | null;
  driver_note: string | null;
  quarter: string | null;
  month: string | null;
  start_date: string | null;
  end_date: string | null;
  status_override: string | null;
  commercial_value: number | null;
  internal_pic: string | null;
  external_contact: string | null;
  theme: string | null;
  source_files: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export type DigitalSubtype = "Social" | "Website" | "Email" | "Video";
export type ChannelScope = "RETAIL" | "WHOLESALE" | "SHARED";

export interface DigitalActivity {
  id: string;
  subtype: DigitalSubtype;
  channel_scope: ChannelScope;
  platform: string | null;
  title: string;
  brand_id: string | null;
  campaign_id: string | null;
  supply_signal_id: string | null;
  driver: string | null;
  planned_date: string | null;
  post_date: string | null;
  status: string | null;
  pic_role: string | null;
  approval_status: string | null;
  evidence_status: string | null;
  week_code: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

export type SupplySignalType =
  | "CONTAINER"
  | "NEW_ARRIVAL"
  | "STOCK_UPDATE"
  | "OOS"
  | "RESTOCK"
  | "ETA_CHANGE"
  | "OEM_ARRIVAL"
  | "OTHER";

export interface SupplySignal {
  id: string;
  signal_type: SupplySignalType;
  supplier: string | null;
  container_no: string | null;
  product_label: string | null;
  eta: string | null;
  location: string | null;
  note: string | null;
  status: string | null;
  channel_scope: ChannelScope;
  week_code: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

/** PROMOTION — a commercial offer on one SKU, one channel. Distinct from Campaign.
 *  status is NOT stored: computed from dates (see status.ts). */
export interface Promotion {
  id: string;
  brand_id: string | null;
  campaign_id: string | null;
  sku_code: string | null;
  sku_name: string | null;
  channel: PromotionChannel;
  customer_type: string | null;
  mechanic: string | null;
  normal_price: number | null;
  promotion_price: number | null;
  discount_label: string | null;
  start_date: string | null;
  end_date: string | null;
  stores_platform: string | null;
  status_override: string | null;
  stock_status: string | null;
  setup_status: "PENDING" | "DONE";
  audit_status: "PENDING" | "AUDITED";
  week_code: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

export interface Deliverable {
  id: string;
  campaign_id: string | null;
  brand_id: string | null;
  workstream: Workstream;
  subtype: string;
  sku_code: string | null;
  sku_name: string | null;
  location: string | null;
  session_label: string | null;
  pic_role: PicRole | null;
  raw_owner: string | null;
  execution_date: string | null;
  execution_deadline: string | null;
  week_code: string | null;
  evidence_required: number;
  evidence_status: string | null;
  status: ControlStatus;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

/** A&P PACKAGE — the commercial commitment for a brand. Distinct from Campaign and Promotion. */
export interface ApPackage {
  id: string;
  brand_id: string | null;
  name: string;
  period_start: string | null;
  period_end: string | null;
  total_value: number | null;
  longdan_fund: number | null;
  brand_investment: number | null;
  status: "IN DELIVERY" | "COMPLETED" | "AWAITING PROPOSAL";
  source_file: string;
  source_sheet: string;
  last_updated: string;
}

/** A&P DELIVERY LINE — one contracted deliverable inside a package. delivered_quantity
 *  is aggregated from the linked operational module, never hand-duplicated. */
export interface ApDeliveryLine {
  id: string;
  package_id: string;
  deliverable_type: string;
  agreed_label: string | null;
  agreed_quantity: number | null;
  agreed_value: number | null;
  delivered_quantity: number | null;
  evidence_status: "PENDING" | "PARTIAL" | "COMPLETE";
  reported: number;
  status: "PENDING" | "IN DELIVERY" | "DELIVERED";
  source_module: string | null;
  link_brand_id: string | null;
  link_subtype: string | null;
  period_start: string | null;
  period_end: string | null;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

/** Commercial/negotiation fact — separate from execution delivery lines. */
export interface ApDealTrackerItem {
  id: string;
  package_id: string;
  deal_point: string;
  deal_type: string | null;
  amount: number | null;
  currency: string | null;
  pic: string | null;
  status: "AGREED" | "DISCUSSED" | "PENDING" | "WAITING";
  discussion: string | null;
  sort_order: number;
  last_updated: string;
}

/** Report-level fields only — the detailed sections (Campaigns/Digital/Demo/...)
 *  are computed at read time from execution modules, never stored here. */
export interface ApCampaignReport {
  id: string;
  package_id: string;
  report_deadline: string | null;
  applied_period_start: string | null;
  applied_period_end: string | null;
  comments: string | null;
  status: "COLLECTING" | "SUBMITTED" | "REVISION REQUESTED" | "FINALISED";
  last_updated: string;
}

export interface ControlTask {
  id: string;
  deliverable_id: string;
  leader_action: LeaderAction;
  title: string;
  control_date: string | null;
  week_code: string | null;
  status: ControlStatus;
  risk_level: RiskLevel;
  risk_reason: string | null;
  next_action: string | null;
  issue_blocker: string | null;
  external_commitment: number;
  external_deadline: string | null;
  external_delivery_status: string | null;
  last_updated: string;
}

export interface ControlTaskView extends ControlTask {
  deliverable_workstream: Workstream;
  deliverable_subtype: string;
  deliverable_pic_role: PicRole | null;
  deliverable_sku_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  brand_name: string | null;
}

export type QuickTaskStatus = "OPEN" | "WAITING" | "DONE" | "CONVERTED";
export type QuickTaskPriority = "LOW" | "MEDIUM" | "HIGH";

/** Personal operational memory — deliberately simpler than ControlTask. See schema.sql. */
export interface QuickTask {
  id: string;
  task: string;
  created_date: string;
  due_date: string | null;
  status: QuickTaskStatus;
  priority: QuickTaskPriority | null;
  pic: string | null;
  related_person: string | null;
  brand_id: string | null;
  activation_id: string | null;
  related_record: string | null;
  note: string | null;
  source: "MANUAL" | "QUICK_NOTE";
  week_code: string | null;
  converted_note: string | null;
  last_updated: string;
}

export interface QuickTaskView extends QuickTask {
  brand_name: string | null;
  activation_name: string | null;
}

export type DesignBriefSheetKind =
  | "CAMPAIGN_BRIEF"
  | "LANDING_PAGE"
  | "DEMO_BRIEF"
  | "GONDOLA_FIXTURE"
  | "PROMOTION_LABEL_TAG"
  | "PROMOTION_LABEL_SKU"
  | "EMAIL_BRIEF"
  | "DEMO_OPERATIONAL_INFO"
  | "INTERNAL_REFERENCE"
  | "EMPTY_TEMPLATE"
  | "UNCLASSIFIED";

/** One source sheet's campaign/activity-level design requirement header. See schema.sql. */
export interface DesignBrief {
  id: string;
  campaign_name: string | null;
  brand_id: string | null;
  campaign_id: string | null;
  campaign_type: string | null;
  theme: string | null;
  cuisine: string | null;
  period_start: string | null;
  period_end: string | null;
  design_deadline: string | null;
  submission_deadline: string | null;
  a_and_p: string | null;
  sheet_kind: DesignBriefSheetKind;
  status: "IMPORTED" | "EXCLUDED";
  exclusion_reason: string | null;
  asset_count: number;
  source_file: string;
  source_sheet: string;
  last_updated: string;
}

export type LeaderAuditState = "TO CHECK" | "DONE" | "ISSUE";

/** One distinct required design deliverable — the primary Marketing Ops checklist row. */
export interface DesignAsset {
  id: string;
  design_brief_id: string;
  activity_id: string | null;
  month_id: string | null;
  category_id: string | null;
  brand_id: string | null;
  campaign_id: string | null;
  asset_type: string;
  variant_label: string | null;
  channel: string;
  channel_subtype: string | null;
  format_raw: string | null;
  headline: string | null;
  secondary_message: string | null;
  cta: string | null;
  content_raw: string;
  promotion_mechanic: string | null;
  promotion_channel: string | null;
  promotion_id: string | null;
  promotion_conflict: number;
  valid_from: string | null;
  valid_until: string | null;
  design_deadline: string | null;
  branding_requirement: string | null;
  theme_ref: string | null;
  design_note: string | null;
  reusable_template: number;
  fixture_parent: string | null;
  possible_duplicate_of: string | null;
  brief_complete: LeaderAuditState;
  sku_complete: LeaderAuditState;
  promotion_verified: LeaderAuditState;
  timeline_verified: LeaderAuditState;
  content_verified: LeaderAuditState;
  branding_verified: LeaderAuditState;
  design_output_received: LeaderAuditState;
  final_output_audited: LeaderAuditState;
  ready_to_publish: LeaderAuditState;
  evidence_link: string | null;
  confidence: "HIGH" | "NEEDS MAPPING" | "UNCLEAR";
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

export interface DesignAssetProduct {
  id: string;
  design_asset_id: string;
  product_code: string | null;
  product_name: string | null;
  product_group: string | null;
  role_note: string | null;
  source_row_ref: string | null;
}

/** See schema.sql — calculated metrics (uplift, CVS rate, FOC efficiency) are
 *  computed at read-time from DemoSessionPerformance, never stored here. */
export interface DemoWeeklyReport {
  id: string;
  week_code: string;
  reported_units_sold: number | null;
  reported_uplift: number | null;
  reported_foc: number | null;
  reported_sessions: number | null;
  reported_stores: number | null;
  reported_brands: number | null;
  key_learning: string | null;
  executive_summary: string | null;
  status: "IMPORTED";
  last_updated: string;
}

export interface DemoSessionPerformance {
  id: string;
  demo_weekly_report_id: string;
  deliverable_id: string | null;
  week_code: string;
  location: string;
  session_label: string | null;
  demo_date: string | null;
  brand_id: string | null;
  brand_name_raw: string | null;
  sku_code: string | null;
  sku_name: string | null;
  promotion_mechanic: string | null;
  promotion_id: string | null;
  demo_type: string | null;
  operated_by: string | null;
  estimated_participants: number | null;
  estimated_interested: number | null;
  customer_reaction: string | null;
  staff_feedback: string | null;
  estimated_participants_from_invoices: number | null;
  foc_quantity: number | null;
  actual_sales_demo_day: number | null;
  sales_week_before: number | null;
  sales_demo_week: number | null;
  avg_weekly_sales_baseline: number | null;
  sales_6mo_total: number | null;
  sales_1mo_total: number | null;
  source_file: string;
  source_sheet: string;
  source_row_ref: string | null;
  last_updated: string;
}

export type DemoActionCategory = "START" | "STOP" | "CONTINUE";

export interface DemoWeeklyAction {
  id: string;
  demo_weekly_report_id: string;
  category: DemoActionCategory;
  title: string;
  description: string | null;
  evidence: string | null;
  source_file: string | null;
  sort_order: number;
}

/** User-generated — never touched by import/re-import. */
export interface DemoWeeklyNote {
  id: string;
  week_code: string;
  note: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
}

export type DemoSourceType =
  | "DEMO_RECORD_EXCEL"
  | "POST_EVENT_EVALUATION_DOCX"
  | "POST_EVENT_EVALUATION_PDF"
  | "SUMMARY"
  | "SUPPORTING";

export interface DemoWeeklySource {
  id: string;
  demo_weekly_report_id: string;
  file_name: string;
  source_type: DemoSourceType;
  extracted_text: string | null;
  imported_at: string;
}

// ── Master data: Portfolio / Category / Month Ledger / Activity ────────────

/** Supplier/Portfolio grouping (e.g. "KFood") — contains many Brands. Never a
 *  Brand, Category or Campaign itself. */
export interface Portfolio {
  id: string;
  name: string;
  source_tag: string | null;
  last_updated: string;
}

export interface Category {
  id: string;
  name: string;
  last_updated: string;
}

/** The control layer marketing work is organised by — never hard-coded. */
export interface MonthLedger {
  id: string; // 'M-2026-10'
  year: number;
  month_number: number;
  month_label: string; // 'October 2026'
  status: string;
  last_updated: string;
}

export type ActivityType = "CAMPAIGN" | "PROMOTION" | "IN-STORE" | "DIGITAL" | "A&P" | "OTHER";

/** Parent of one or more Design Assets sharing the same Brand + Activity Type
 *  + Activity Label within one brief (Wobbler + Shelf Strip for the same
 *  Dongwon "In-store Promotion" are ONE activity, not two). */
export interface DesignActivity {
  id: string;
  month_id: string | null;
  design_brief_id: string;
  brand_id: string | null;
  portfolio_id: string | null;
  campaign_id: string | null;
  activity_type: ActivityType;
  activity_label: string;
  promotion_mechanic: string | null;
  promotion_channel: string | null;
  start_date: string | null;
  end_date: string | null;
  source_file: string;
  source_sheet: string;
  last_updated: string;
}

// ── Master Knowledge Base ───────────────────────────────────────────────────
// Stable business knowledge (rules, rates, working methods) — never live
// execution data. See schema.sql for the KNOWLEDGE vs EXECUTION separation.

export type MasterStatus = "CURRENT" | "HISTORICAL" | "NEEDS VERIFICATION";

export interface MasterService {
  id: string;
  category: string;
  service_name: string;
  package: string | null;
  description: string | null;
  price_gbp: string | null;
  price_usd: string | null;
  price_eur: string | null;
  duration: string | null;
  store_coverage: string | null;
  channel: string | null;
  coverage_raw: string | null;
  notes: string | null;
  description_vi: string | null;
  year: number;
  effective_period: string | null;
  source: string | null;
  status: MasterStatus;
  last_updated: string;
  sort_order: number;
}

export interface MasterCoverageTerm {
  id: string;
  term_type: string;
  term_value: string;
  year: number;
  sort_order: number;
}

export interface MasterCampaignType {
  id: string;
  name: string;
  what_it_is: string | null;
  frequency: string | null;
  timing_rule: string | null;
  duration: string | null;
  purpose: string | null;
  typical_deliverables: string | null;
  notes: string | null;
  explanation_vi: string | null;
  year: number;
  effective_period: string | null;
  source: string | null;
  status: MasterStatus;
  last_updated: string;
  sort_order: number;
}

export interface MasterCalendarMonth {
  id: string;
  year: number;
  month_number: number;
  theme: string | null;
  campaign_type: string | null;
  campaign_name: string | null;
  planning_date: string | null;
  start_date: string | null;
  end_date: string | null;
  hero_category: string | null;
  special_dates: string | null;
  source: string | null;
  status: MasterStatus;
  last_updated: string;
}

export interface MasterApPlaybookStep {
  id: string;
  step_order: number;
  step_name: string;
  description: string | null;
  description_vi: string | null;
  rules: string | null;
  source: string | null;
  status: MasterStatus;
  last_updated: string;
}

export interface MasterApChecklistItem {
  id: string;
  sort_order: number;
  item: string;
}

export interface MasterHandbookEntry {
  id: string;
  category: string;
  title: string;
  body: string | null;
  body_vi: string | null;
  summary_vi: string | null;
  source: string | null;
  status: MasterStatus;
  last_updated: string;
  sort_order: number;
}

/** One PIC/workstream's recurring working rhythm — who does what, when, and
 *  hands off to whom. A field with no supplied source stays null; never
 *  invented to fill the shape. */
export interface MasterWorkstream {
  id: string;
  pic_name: string;
  recurring_tasks: string | null;
  recurring_tasks_vi: string | null;
  weekly_timing: string | null;
  weekly_timing_vi: string | null;
  input_needed: string | null;
  input_needed_vi: string | null;
  my_action: string | null;
  my_action_vi: string | null;
  handover_to: string | null;
  handover_to_vi: string | null;
  deadline: string | null;
  deadline_vi: string | null;
  output: string | null;
  output_vi: string | null;
  check_audit: string | null;
  check_audit_vi: string | null;
  important_rules: string | null;
  important_rules_vi: string | null;
  execution_detail: string | null;
  execution_detail_vi: string | null;
  status: MasterStatus;
  source: string | null;
  last_updated: string;
  sort_order: number;
}

/** Operational SOP / lookup procedure for running campaigns & promotions day
 *  to day — distinct from MasterCampaignType (the taxonomy/timing rules).
 *  Displayed the same way as Team Workstreams: collapsed, click to expand. */
export interface MasterCampaignRule {
  id: string;
  rule_name: string;
  category: string;
  summary: string | null;
  body: string | null;
  body_vi: string | null;
  status: MasterStatus;
  source: string | null;
  last_updated: string;
  sort_order: number;
}

// ── Projects — project control system ───────────────────────────────────────

export type ProjectStatus = "Planning" | "Proposal" | "Submitted" | "Approved" | "Execution" | "Reporting" | "Claim" | "Completed" | "Failed" | "On Hold";
export type InfoStatus = "CONFIRMED" | "WORKING" | "TO CONFIRM" | "SUPERSEDED" | "CANCELLED";

export interface Project {
  id: string;
  name: string;
  project_type: string;
  partner: string | null;
  funding_source: string | null;
  execution_company: string | null;
  period_start: string | null;
  period_end: string | null;
  current_stage: string | null;
  overall_status: ProjectStatus;
  failure_reason: string | null;
  pic: string | null;
  summary: string | null;
  next_action: string | null;
  main_store_scope: string | null;
  main_product_focus: string | null;
  ap_package_id: string | null;
  brand_id: string | null;
  source_file: string | null;
  last_updated: string;
}

export interface ProjectFunding {
  id: string;
  project_id: string;
  funding_label: string;
  amount: string | null;
  currency: string | null;
  flow: string | null;
  contribution_note: string | null;
  status: InfoStatus;
  sort_order: number;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  milestone_name: string;
  deadline: string | null;
  owner: string | null;
  status: "PLANNED" | "IN PROGRESS" | "DONE" | "AT RISK";
  dependency: string | null;
  sort_order: number;
}

export interface ProjectWorkstream {
  id: string;
  project_id: string;
  workstream_name: string;
  detail: string | null;
  status: string;
  linked_campaign_id: string | null;
  linked_brand_id: string | null;
  sort_order: number;
}

export interface ProjectInformation {
  id: string;
  project_id: string;
  category: string;
  label: string;
  detail: string | null;
  status: InfoStatus;
  effective_date: string | null;
  source: string | null;
  sort_order: number;
  last_updated: string;
}

export interface ProjectDemoProduct {
  id: string;
  project_id: string;
  month_label: string;
  week_label: string | null;
  product_code: string | null;
  product_name: string;
  status: "PLANNED" | "TO CONFIRM" | "CONFIRMED";
  notes: string | null;
  sort_order: number;
}

export interface ProjectPosmItem {
  id: string;
  project_id: string;
  posm_type: string;
  quantity_scope: string | null;
  status: string;
  notes: string | null;
  sort_order: number;
}

export interface ProjectCookingGuideline {
  id: string;
  project_id: string;
  product_name: string;
  instructions: string;
  sort_order: number;
}

export interface ProjectAction {
  id: string;
  project_id: string;
  action: string;
  workstream: string | null;
  owner: string | null;
  deadline: string | null;
  status: "PLANNED" | "URGENT" | "WAITING" | "TO CONFIRM" | "IN PROGRESS" | "DONE";
  dependency: string | null;
  latest_update: string | null;
  sort_order: number;
}

export interface ProjectRisk {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface ProjectDetailSection {
  id: string;
  project_id: string;
  section_key: string;
  title: string;
  body: string | null;
  sort_order: number;
}
