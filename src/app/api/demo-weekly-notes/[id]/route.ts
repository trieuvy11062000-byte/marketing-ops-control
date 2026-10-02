import { NextRequest, NextResponse } from "next/server";
import { deleteDemoWeeklyNote } from "@/lib/queries/demoReports";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteDemoWeeklyNote(decodeURIComponent(id));
  return NextResponse.json({ ok: true });
}
