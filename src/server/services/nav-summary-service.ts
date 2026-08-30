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

  const [inboxOpenRow, hotRepliesRow] = await Promise.all([
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
    inboxOpen: inboxOpenRow?.count ?? 0,
    hotReplies: hotRepliesRow?.count ?? 0,
  };
}