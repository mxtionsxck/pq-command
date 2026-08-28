import type { ReactNode } from "react";

import { StatusPill } from "./status-pill";
import type { StatusTone } from "@/lib/design-tokens";

type TimelineItem = Readonly<{
  id: string;
  title: string;
  description: string;
  meta: string;
  tone?: StatusTone;
  aside?: ReactNode;
}>;

type TimelineProps = Readonly<{
  items: readonly TimelineItem[];
}>;

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li
          className="relative rounded-[var(--pq-radius-lg)] border border-[color:var(--pq-border)] bg-white/4 p-5 pl-8"
          key={item.id}
        >
          <span
            aria-hidden="true"
            className="absolute left-4 top-6 size-2 rounded-full bg-[color:var(--pq-accent)]"
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-white">
                  {item.title}
                </h3>
                {item.tone ? (
                  <StatusPill tone={item.tone}>{item.meta}</StatusPill>
                ) : null}
              </div>
              <p className="pq-copy-muted text-sm leading-6">
                {item.description}
              </p>
            </div>
            {item.aside ? (
              <div className="pq-copy-subtle text-sm">{item.aside}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
