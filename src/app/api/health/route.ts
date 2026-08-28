import { NextResponse } from "next/server";

import { buildHealthSnapshot } from "../../../server/services/health-service";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(buildHealthSnapshot(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
