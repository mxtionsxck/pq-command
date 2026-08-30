import { and, count, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { conversations } from "@/db/schema";
import { appEnv } from "@/lib/env";

export type NavSummary = {
  inboxOpen: number;
  hotReplies: number;
};

export async function getNavSummary(): Promise<NavSummary> {
  if (!getDatabaseConfig(appEnv).configured) {
    return {
      inboxOpen: 0,
      hotReplies: 0,
    };
  }

  const db = getDb();

  const [inboxOpenRows, hotRepliesRows] = await Promise.all([
    db
      .select({ count: count(conversations.id) })
      .from(conversations)
      .where(
        and(
          isNull(conversations.archivedAt),
          inArray(conversations.status, ["open", "pending"]),
        ),
      ),
    db
      .select({ count: count(conversations.id) })
      .from(conversations)
      .where(
        and(
          isNull(conversations.archivedAt),
          inArray(conversations.inboxCategory, ["HOT", "INTERESTED"]),
          inArray(conversations.status, ["open", "pending"]),
        ),
      ),
  ]);

  return {
    inboxOpen: inboxOpenRows[0]?.count ?? 0,
    hotReplies: hotRepliesRows[0]?.count ?? 0,
  };
}