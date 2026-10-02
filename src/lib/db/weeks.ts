// Longdan operates on a Friday-start retail week. Confirmed from source data:
// Demo26 sheet: "W01" -> FRI 2026-01-02. Email+Web27 header: "WEEK START-FRI".
// W01 2026 starts Friday 2 Jan 2026.

const WEEK01_START = new Date(Date.UTC(2026, 0, 2)); // 2026-01-02, Friday
const TOTAL_WEEKS = 52;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function addDays(d: Date, days: number): string {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd.toISOString().slice(0, 10);
}

function quarterOf(monthIndex0: number): string {
  return `Q${Math.floor(monthIndex0 / 3) + 1}`;
}

export interface WeekRow {
  week_code: string;
  year: number;
  week_number: number;
  start_date: string;
  end_date: string;
  month: string;
  quarter: string;
  parity: "ODD" | "EVEN";
}

export function generateWeeks2026(): WeekRow[] {
  const rows: WeekRow[] = [];
  for (let n = 1; n <= TOTAL_WEEKS; n++) {
    const startDate = new Date(WEEK01_START);
    startDate.setUTCDate(startDate.getUTCDate() + (n - 1) * 7);
    const start_date = addDays(startDate, 0);
    const end_date = addDays(startDate, 6);
    const monthIndex0 = startDate.getUTCMonth();
    rows.push({
      week_code: `W${String(n).padStart(2, "0")}`,
      year: 2026,
      week_number: n,
      start_date,
      end_date,
      month: MONTH_NAMES[monthIndex0],
      quarter: quarterOf(monthIndex0),
      parity: n % 2 === 0 ? "EVEN" : "ODD",
    });
  }
  return rows;
}

/** Returns the W## code covering a given ISO date (2026 only). */
export function weekCodeForDate(isoDate: string): string | null {
  const d = new Date(isoDate + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  const diffDays = Math.floor((d.getTime() - WEEK01_START.getTime()) / 86400000);
  const n = Math.floor(diffDays / 7) + 1;
  if (n < 1 || n > TOTAL_WEEKS) return null;
  return `W${String(n).padStart(2, "0")}`;
}

export function weekCodeMinus(weekCode: string, weeksBack: number): string | null {
  const n = parseInt(weekCode.replace("W", ""), 10) - weeksBack;
  if (n < 1 || n > TOTAL_WEEKS) return null;
  return `W${String(n).padStart(2, "0")}`;
}

export function currentWeekCode(today: Date = new Date()): string {
  const iso = today.toISOString().slice(0, 10);
  return weekCodeForDate(iso) ?? "W01";
}
