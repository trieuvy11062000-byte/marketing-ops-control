import { NextRequest, NextResponse } from "next/server";
import { createQuickTask, listQuickTasks } from "@/lib/queries/quickTasks";
import type { QuickTaskStatus } from "@/lib/db/types";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as QuickTaskStatus | null;
  const tasks = listQuickTasks(status ?? undefined);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.task || typeof body.task !== "string" || !body.task.trim()) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }
  const id = createQuickTask(body);
  return NextResponse.json({ id }, { status: 201 });
}
