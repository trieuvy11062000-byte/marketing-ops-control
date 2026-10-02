import { currentWeekCode, generateWeeks2026 } from "../src/lib/db/weeks";

const wk = currentWeekCode(new Date("2026-09-30T00:00:00Z"));
console.log("today week:", wk);
const weeks = generateWeeks2026();
console.log(weeks.find((w) => w.week_code === wk));
console.log(weeks.filter((w) => ["W38", "W39", "W40", "W41", "W42", "W43"].includes(w.week_code)));
