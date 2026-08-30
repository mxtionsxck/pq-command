import { and, desc, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { createEntityId } from "@/db/ids";
import { signals, sources } from "@/db/schema";
import { appEnv } from "@/lib/env";

function getDbOrNull() {
  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return getDb();
}

function extractHost(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function looksRelevant(url: string) {
  const lower = url.toLowerCase();
  return [
    "company-let",
    "company%20let",
    "corporate",
    "investor",
    "landlord",
    "developer",
    "portfolio",
    "block",
    "multi-unit",
    "units",
    "completion",
    "handover",
    "wanted",
    "requirement",
  ].some((keyword) => lower.includes(keyword));
}

export function createSourceExpansionService() {
  const db = getDbOrNull();

  return {
    async discoverCandidateSources(limit = 150) {
      if (!db) {
        return [] as Array<{ url: string; domain: string; signalId: string }>;
      }

      const rows = await db
        .select({
          signalId: signals.id,
          rawFields: sql<Record<string, unknown>>`${signals.payload} -> 'rawFields'`,
        })
        .from(signals)
        .where(inArray(signals.type, ["PRIVATE_LANDLORD", "DEVELOPER", "MULTI_UNIT", "inquiry"]))
        .orderBy(desc(signals.createdAt))
        .limit(800);

      const candidates = new Map<string, { url: string; domain: string; signalId: string }>();

      for (const row of rows) {
        const rawFields = row.rawFields;
        const discoveredLinks = Array.isArray(rawFields?.["discoveredLinks"])
          ? rawFields["discoveredLinks"].filter((item): item is string => typeof item === "string")
          : [];

        for (const url of discoveredLinks) {
          if (!looksRelevant(url)) {
            continue;
          }

          const host = extractHost(url);
          if (!host) {
            continue;
          }

          if (!candidates.has(host)) {
            candidates.set(host, {
              url,
              domain: host,
              signalId: row.signalId,
            });
          }
        }
      }

      return Array.from(candidates.values()).slice(0, limit);
    },

    async registerDiscoveredSources() {
      if (!db) {
        return { created: 0, skipped: 0 };
      }

      const candidates = await this.discoverCandidateSources(150);
      if (candidates.length === 0) {
        return { created: 0, skipped: 0 };
      }

      const existing = await db
        .select({ name: sources.name })
        .from(sources)
        .where(isNull(sources.archivedAt));

      const existingNames = new Set(existing.map((row) => row.name.toLowerCase()));
      let created = 0;
      let skipped = 0;

      for (const candidate of candidates) {
        const sourceName = `AUTO:${candidate.domain}`;
        if (existingNames.has(sourceName.toLowerCase())) {
          skipped += 1;
          continue;
        }

        await db.insert(sources).values({
          id: createEntityId("src"),
          name: sourceName,
          kind: "website",
          status: "paused",
          connectorKey: null,
          permissionStatus: "REVIEW_REQUIRED",
          allowedData: "public_pages,public_posts,public_comments",
          rateLimitPerMinute: 6,
          enabled: false,
          health: "unknown",
          notes:
            "Auto-discovered candidate source. Requires manual legal/policy review and explicit connector assignment before use.",
          config: {
            seedUrl: candidate.url,
            domain: candidate.domain,
            discoveredFromSignalId: candidate.signalId,
          },
        });

        existingNames.add(sourceName.toLowerCase());
        created += 1;
      }

      return { created, skipped };
    },

    async listAutoDiscoveredSources(limit = 120) {
      if (!db) {
        return [];
      }

      return db
        .select()
        .from(sources)
        .where(
          and(
            sql<boolean>`${sources.name} like 'AUTO:%'`,
            isNull(sources.archivedAt),
          ),
        )
        .orderBy(desc(sources.updatedAt), desc(sources.createdAt))
        .limit(limit);
    },
  };
}
