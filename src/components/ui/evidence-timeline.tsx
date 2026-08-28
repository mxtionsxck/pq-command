import type { EvidenceTimelineItem } from "@/domain/evidence/types";

import { Timeline } from "./timeline";

function methodTone(method: EvidenceTimelineItem["collectionMethod"]) {
  if (method === "manual") {
    return "neutral" as const;
  }

  if (method === "connector") {
    return "info" as const;
  }

  if (method === "ai_extraction") {
    return "success" as const;
  }

  return "warning" as const;
}

export function EvidenceTimeline({
  items,
}: Readonly<{ items: readonly EvidenceTimelineItem[] }>) {
  return (
    <Timeline
      items={items.map((item) => ({
        id: item.id,
        title: `${item.sourceReference} (${item.confidence})`,
        description: item.summary,
        meta: `${item.collectionMethod} | signal ${item.signalId}`,
        tone: methodTone(item.collectionMethod),
        aside: item.sourceUrl ? (
          <a
            className="text-[color:var(--pq-accent-strong)] underline"
            href={item.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Source link
          </a>
        ) : (
          item.detectedAt.toISOString()
        ),
      }))}
    />
  );
}
