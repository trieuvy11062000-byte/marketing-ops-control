import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { generateWeeks2026 } from "./weeks";
import { seedMasterKnowledge } from "./masterSeed";
import { seedProjects } from "./projectSeed";
import { seedApExamples } from "./apSeed";
import { backfillBrandLinks } from "./crossLinkBackfill";

const DB_PATH = path.join(process.cwd(), "data", "marketing_ops.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema.sql");

declare global {
  // eslint-disable-next-line no-var
  var __mocDb: Database.Database | undefined;
}

/** Adds a column to an existing table if it isn't already there. CREATE TABLE
 *  IF NOT EXISTS is a no-op once a table exists, so new columns on long-lived
 *  tables (brands, design_assets) need this instead — additive, never destructive. */
function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initSchema(db: Database.Database) {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);

  ensureColumn(db, "brands", "portfolio_id", "TEXT REFERENCES portfolios(id)");
  ensureColumn(db, "design_assets", "activity_id", "TEXT REFERENCES design_activities(id)");
  ensureColumn(db, "design_assets", "month_id", "TEXT REFERENCES months(id)");
  ensureColumn(db, "design_assets", "category_id", "TEXT REFERENCES categories(id)");
  ensureColumn(db, "master_services", "description_vi", "TEXT");
  ensureColumn(db, "master_campaign_types", "explanation_vi", "TEXT");
  ensureColumn(db, "master_handbook_entries", "summary_vi", "TEXT");
  ensureColumn(db, "master_ap_playbook_steps", "description_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "execution_detail", "TEXT");
  ensureColumn(db, "master_workstreams", "recurring_tasks_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "weekly_timing_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "input_needed_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "my_action_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "handover_to_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "deadline_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "output_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "check_audit_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "important_rules_vi", "TEXT");
  ensureColumn(db, "master_workstreams", "execution_detail_vi", "TEXT");
  ensureColumn(db, "master_campaign_rules", "body_vi", "TEXT");
  ensureColumn(db, "master_handbook_entries", "body_vi", "TEXT");

  const count = db.prepare("SELECT COUNT(*) as c FROM weeks").get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare(
      `INSERT INTO weeks (week_code, year, week_number, start_date, end_date, month, quarter, parity)
       VALUES (@week_code, @year, @week_number, @start_date, @end_date, @month, @quarter, @parity)`
    );
    const insertMany = db.transaction((rows: ReturnType<typeof generateWeeks2026>) => {
      for (const row of rows) insert.run(row);
    });
    insertMany(generateWeeks2026());
  }

  seedMasterKnowledge(db);
  seedProjects(db);
  seedApExamples(db);
  backfillBrandLinks(db);
}

export function getDb(): Database.Database {
  if (!global.__mocDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    global.__mocDb = db;
  }
  return global.__mocDb;
}
