import { NextRequest, NextResponse } from "next/server";
import { deleteQuickTask, updateQuickTask } from "@/lib/queries/quickTasks";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  updateQuickTask(decodeURIComponent(id), body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteQuickTask(decodeURIComponent(id));
  return NextResponse.json({ ok: true });
}
