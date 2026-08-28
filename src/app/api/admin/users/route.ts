import { NextResponse } from "next/server";

import { appEnv } from "@/lib/env";
import { canManageUsers } from "@/server/auth/rbac";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { createAdminUserService } from "@/server/services/admin-user-service";
import { getDatabaseConfig } from "@/db/config";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  if (!canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rate = consumeRateLimit({
    key: `api:admin:users:${user.id}`,
    max: 60,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  const database = getDatabaseConfig(appEnv);

  if (!database.configured) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL is not configured. The admin user management surface remains disconnected.",
      },
      { status: 503 },
    );
  }

  const adminUserService = createAdminUserService();
  const users = await adminUserService.listUsers();

  return NextResponse.json(
    {
      users,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
