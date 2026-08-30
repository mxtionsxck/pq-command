import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/auth/session";
import { getNavSummary } from "@/server/services/nav-summary-service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  const summary = await getNavSummary();

  return NextResponse.json(summary, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}