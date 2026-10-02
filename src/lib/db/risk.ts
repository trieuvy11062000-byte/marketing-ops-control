import type { ControlTask, Deliverable, RiskLevel } from "./types";

const CLOSED_STATES = new Set(["APPROVED", "CLOSED", "DELIVERED"]);
const SHIP_DEPENDENT_SUBTYPES = new Set(["POSM", "TVC", "Tent Card", "Wobbler", "Shelf Strip", "Poster"]);

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export interface RiskResult {
  level: RiskLevel;
  reason: string | null;
}

/**
 * Rule-driven risk, never manually set (section 27).
 * `today` is injectable for deterministic tests.
 */
export function computeRisk(
  task: Pick<ControlTask, "control_date" | "status" | "external_commitment" | "external_deadline" | "external_delivery_status">,
  deliverable: Pick<Deliverable, "subtype" | "execution_date" | "evidence_required" | "evidence_status">,
  today: Date = new Date()
): RiskResult {
  if (CLOSED_STATES.has(task.status) || task.status === "CLOSED") {
    return { level: "GREEN", reason: null };
  }

  if (task.status === "BLOCKED") {
    return { level: "RED", reason: "Execution blocked" };
  }

  if (task.control_date) {
    const controlDate = new Date(task.control_date + "T00:00:00Z");
    const diff = daysBetween(controlDate, today);
    if (diff > 0) {
      return { level: "RED", reason: `Leader control overdue by ${diff}d` };
    }
  }

  if (task.external_commitment && task.external_deadline) {
    const extDate = new Date(task.external_deadline + "T00:00:00Z");
    const diff = daysBetween(extDate, today);
    if (diff > 0 && task.external_delivery_status !== "DELIVERED") {
      return { level: "RED", reason: `External deadline overdue by ${diff}d` };
    }
  }

  if (SHIP_DEPENDENT_SUBTYPES.has(deliverable.subtype) && deliverable.execution_date) {
    const execDate = new Date(deliverable.execution_date + "T00:00:00Z");
    const cutoff = new Date(execDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - 14); // T-2 weeks shipping cut-off
    if (daysBetween(cutoff, today) > 0) {
      return { level: "RED", reason: "AT RISK – shipping cut-off missed (T-2 weeks)" };
    }
    if (daysBetween(cutoff, today) >= -3) {
      return { level: "AMBER", reason: "Approaching shipping cut-off (T-2 weeks)" };
    }
  }

  if (deliverable.evidence_required && deliverable.evidence_status === "PENDING" && deliverable.execution_date) {
    const execDate = new Date(deliverable.execution_date + "T00:00:00Z");
    if (daysBetween(execDate, today) >= 0) {
      return { level: "AMBER", reason: "Evidence pending after execution" };
    }
  }

  if (task.control_date) {
    const controlDate = new Date(task.control_date + "T00:00:00Z");
    const diff = daysBetween(today, controlDate);
    if (diff >= 0 && diff <= 2) {
      return { level: "AMBER", reason: `Due within ${diff}d` };
    }
  }

  if (task.status === "WAITING FOR OUTPUT" || task.status === "WAITING FOR LEADER REVIEW") {
    return { level: "AMBER", reason: "Awaiting input" };
  }

  return { level: "GREEN", reason: null };
}
