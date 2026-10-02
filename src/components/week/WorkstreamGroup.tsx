import { TaskRow, EmptyRow } from "@/components/ui/TaskRow";
import { CollapsibleGroup } from "./CollapsibleGroup";
import type { ControlTaskView } from "@/lib/db/types";

export function WorkstreamGroup({ title, tasks }: { title: string; tasks: ControlTaskView[] }) {
  const redCount = tasks.filter((t) => t.risk_level === "RED").length;
  return (
    <CollapsibleGroup title={title} count={tasks.length} alertCount={redCount}>
      {tasks.length === 0 ? <EmptyRow label="Nothing in this workstream" /> : tasks.map((t) => <TaskRow key={t.id} task={t} />)}
    </CollapsibleGroup>
  );
}
