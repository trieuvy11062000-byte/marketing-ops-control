import { NextRequest, NextResponse } from "next/server";
import { createDemoWeeklyNote } from "@/lib/queries/demoReports";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.weekCode || !body.note || typeof body.note !== "string" || !body.note.trim()) {
    return NextResponse.json({ error: "weekCode and note are required" }, { status: 400 });
  }
  const id = createDemoWeeklyNote({
    weekCode: body.weekCode,
    note: body.note.trim(),
    category: body.category ?? null,
    createdBy: body.createdBy ?? null,
  });
  return NextResponse.json({ id }, { status: 201 });
}
