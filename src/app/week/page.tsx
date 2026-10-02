import { redirect } from "next/navigation";
import { currentWeekCode } from "@/lib/db/weeks";

export default function WeekIndexPage() {
  redirect(`/week/${currentWeekCode()}`);
}
