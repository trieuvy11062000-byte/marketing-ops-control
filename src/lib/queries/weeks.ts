import { getDb } from "../db/client";
import type { WeekRow } from "../db/weeks";

export function getWeek(weekCode: string): WeekRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM weeks WHERE week_code = ?").get(weekCode) as WeekRow | undefined;
}

export function getAllWeeks(): WeekRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM weeks ORDER BY week_number").all() as WeekRow[];
}

export function getAdjacentWeek(weekCode: string, delta: number): WeekRow | undefined {
  const db = getDb();
  const n = parseInt(weekCode.replace(/^W/i, ""), 10) + delta;
  const code = `W${String(n).padStart(2, "0")}`;
  return getWeek(code);
}

export interface WeekLoad {
  week_code: string;
  count: number;
}

export function getWeekWorkload(fromWeek: string, toWeek: string): WeekLoad[] {
  const db = getDb();
  const from = parseInt(fromWeek.replace(/^W/i, ""), 10);
  const to = parseInt(toWeek.replace(/^W/i, ""), 10);
  const rows = db
    .prepare(
      `SELECT week_code, COUNT(*) as count FROM control_tasks
       WHERE week_code IS NOT NULL AND status NOT IN ('CLOSED','APPROVED','DELIVERED')
       GROUP BY week_code`
    )
    .all() as WeekLoad[];
  const map = new Map(rows.map((r) => [r.week_code, r.count]));
  const result: WeekLoad[] = [];
  for (let n = from; n <= to; n++) {
    const code = `W${String(n).padStart(2, "0")}`;
    result.push({ week_code: code, count: map.get(code) ?? 0 });
  }
  return result;
}
