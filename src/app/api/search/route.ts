import { NextRequest, NextResponse } from "next/server";
import { search } from "@/lib/queries/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const groups = search(q);
  return NextResponse.json({ groups });
}
