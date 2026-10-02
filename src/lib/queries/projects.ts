import { getDb } from "../db/client";
import type {
  Project,
  ProjectAction,
  ProjectCookingGuideline,
  ProjectDemoProduct,
  ProjectDetailSection,
  ProjectFunding,
  ProjectInformation,
  ProjectMilestone,
  ProjectPosmItem,
  ProjectRisk,
  ProjectWorkstream,
} from "../db/types";

export interface ProjectListRow extends Project {
  brand_name: string | null;
  next_deadline: string | null;
}

/** List view — one card per project, including FAILED (never hidden/deleted —
 *  project history is a learning record, not noise to filter out). */
export function listProjects(): ProjectListRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.*, b.name as brand_name,
              (SELECT m.deadline FROM project_milestones m WHERE m.project_id = p.id AND m.status IN ('PLANNED','IN PROGRESS','AT RISK') AND m.deadline IS NOT NULL ORDER BY m.sort_order LIMIT 1) as next_deadline
       FROM projects p
       LEFT JOIN brands b ON b.id = p.brand_id
       ORDER BY CASE p.overall_status WHEN 'Failed' THEN 1 ELSE 0 END, p.last_updated DESC`
    )
    .all() as ProjectListRow[];
}

export function getProject(id: string): (Project & { brand_name: string | null }) | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT p.*, b.name as brand_name FROM projects p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id = ?`)
    .get(id) as (Project & { brand_name: string | null }) | undefined;
}

export function listProjectFunding(projectId: string): ProjectFunding[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_funding WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectFunding[];
}

export function listProjectMilestones(projectId: string): ProjectMilestone[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectMilestone[];
}

export function listProjectWorkstreams(projectId: string): (ProjectWorkstream & { campaign_name: string | null; brand_name: string | null })[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT w.*, c.name as campaign_name, b.name as brand_name
       FROM project_workstreams w
       LEFT JOIN campaigns c ON c.id = w.linked_campaign_id
       LEFT JOIN brands b ON b.id = w.linked_brand_id
       WHERE w.project_id = ? ORDER BY w.sort_order`
    )
    .all(projectId) as (ProjectWorkstream & { campaign_name: string | null; brand_name: string | null })[];
}

/** Current (non-superseded/cancelled) information, grouped by category — the
 *  Fixed/Detailed Information panels only ever show the live version. */
export function listCurrentProjectInformation(projectId: string): ProjectInformation[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM project_information WHERE project_id = ? AND status NOT IN ('SUPERSEDED','CANCELLED') ORDER BY sort_order")
    .all(projectId) as ProjectInformation[];
}

/** Full history (current + superseded/cancelled) grouped by category — the
 *  Decision & Change History panel. Never merges a superseded row into current. */
export function listProjectInformationHistory(projectId: string): ProjectInformation[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_information WHERE project_id = ? ORDER BY category, sort_order").all(projectId) as ProjectInformation[];
}

export function listProjectDemoProducts(projectId: string): ProjectDemoProduct[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_demo_products WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectDemoProduct[];
}

export function listProjectPosmItems(projectId: string): ProjectPosmItem[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_posm_items WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectPosmItem[];
}

export function listProjectCookingGuidelines(projectId: string): ProjectCookingGuideline[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_cooking_guidelines WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectCookingGuideline[];
}

export function listProjectActions(projectId: string): ProjectAction[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_actions WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectAction[];
}

export function listProjectRisks(projectId: string): ProjectRisk[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_risks WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectRisk[];
}

export function listProjectDetailSections(projectId: string): ProjectDetailSection[] {
  const db = getDb();
  return db.prepare("SELECT * FROM project_detail_sections WHERE project_id = ? ORDER BY sort_order").all(projectId) as ProjectDetailSection[];
}

export interface ProjectActionBuckets {
  next7Days: ProjectAction[];
  overdue: ProjectAction[];
  waitingForOthers: ProjectAction[];
  needMyAction: ProjectAction[];
  other: ProjectAction[];
}

/** Buckets actions by status only — deadlines in this dataset are free text
 *  ("TBC", "Before Nov demos") rather than ISO dates, so "Next 7 Days" /
 *  "Overdue" can't be computed by date math without inventing structure the
 *  source doesn't have. Bucketed by explicit status instead. */
export function bucketProjectActions(actions: ProjectAction[]): ProjectActionBuckets {
  const buckets: ProjectActionBuckets = { next7Days: [], overdue: [], waitingForOthers: [], needMyAction: [], other: [] };
  for (const a of actions) {
    if (a.status === "WAITING") buckets.waitingForOthers.push(a);
    else if (a.status === "URGENT") buckets.overdue.push(a);
    else if (a.status === "TO CONFIRM" || a.status === "IN PROGRESS") buckets.needMyAction.push(a);
    else buckets.other.push(a);
  }
  return buckets;
}
