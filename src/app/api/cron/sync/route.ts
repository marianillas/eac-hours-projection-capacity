import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runSync();
  console.log(
    `[cron sync] ${result.entriesProcessed} entries processed, ${result.unclassifiedEntries} unclassified, ${result.warnings.length} warning(s)`,
  );
  return NextResponse.json(result);
}
