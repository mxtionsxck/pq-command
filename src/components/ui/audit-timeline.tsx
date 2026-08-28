import type { AuditEvent } from "@/db/models";

import { Timeline } from "./timeline";

function summarizeMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata).slice(0, 4);

  if (entries.length === 0) {
    return "No additional audit metadata recorded.";
  }

  return entries
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
    )
    .join(" | ");
}

function toneForAction(action: string) {
  if (action.includes("archived") || action.includes("deleted")) {
    return "warning" as const;
  }

  if (action.includes("failed")) {
    return "danger" as const;
  }

  if (action.includes("created")) {
    return "success" as const;
  }

  return "info" as const;
}

export function AuditTimeline({
  events,
}: Readonly<{ events: readonly AuditEvent[] }>) {
  return (
    <Timeline
      items={events.map((event) => ({
        id: event.id,
        title: `${event.entityType} ${event.action}`,
        description: summarizeMetadata(event.metadata),
        meta: event.actorType,
        tone: toneForAction(event.action),
        aside: event.occurredAt.toISOString(),
      }))}
    />
  );
}
