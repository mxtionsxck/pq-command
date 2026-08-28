import type { ReactNode } from "react";

import { Card } from "./card";
import { StatusPill } from "./status-pill";
import type { StatusTone } from "@/lib/design-tokens";

type StatCardProps = Readonly<{
  label: string;
  value: string;
  change?: string;
  tone?: StatusTone;
  detail?: ReactNode;
}>;

export function StatCard({
  change,
  detail,
  label,
  tone = "neutral",
  value,
}: StatCardProps) {
  return (
    <Card className="min-h-[11.5rem]">
      <div className="space-y-4">
        <p className="pq-kicker">{label}</p>
        <div className="flex items-end justify-between gap-4 border-b border-[color:rgba(215,192,140,0.08)] pb-4">
          <p className="text-4xl font-semibold tracking-[-0.03em] text-white">{value}</p>
          {change ? <StatusPill tone={tone}>{change}</StatusPill> : null}
        </div>
        {detail ? (
          <div className="pq-copy-muted text-sm leading-6">{detail}</div>
        ) : null}
      </div>
    </Card>
  );
}
