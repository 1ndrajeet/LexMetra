// app/api/health/db/route.ts
import { checkDatabaseStatus } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const status = await checkDatabaseStatus();
  return NextResponse.json(status);
}