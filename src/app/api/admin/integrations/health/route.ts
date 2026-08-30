import { NextResponse } from "next/server";

import { listIntegrations } from "@/integrations";
import { appEnv } from "@/lib/env";

export const runtime = "nodejs";

export function GET() {
  const integrations = listIntegrations(appEnv);

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      total: integrations.length,
      connected: integrations.filter((item) => item.status === "connected").length,
      configurationRequired: integrations.filter(
        (item) => item.status === "configuration_required",
      ).length,
      failed: integrations.filter((item) => item.status === "failed").length,
      notEnabled: integrations.filter((item) => item.status === "not_enabled").length,
      integrations,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
