import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/design-tokens";

type BadgeProps = Readonly<{
  tone?: StatusTone;
}> &
  HTMLAttributes<HTMLSpanElement>;

const toneClassMap: Record<StatusTone, string> = {
  neutral: "bg-[rgba(215,192,140,0.08)] text-[color:var(--pq-color-ivory-100)] border-[rgba(215,192,140,0.14)]",
  info: "bg-[rgba(111,143,181,0.16)] text-[color:var(--pq-color-ivory-100)] border-[rgba(111,143,181,0.24)]",
  success:
    "bg-[rgba(59,167,118,0.16)] text-[color:var(--pq-color-ivory-100)] border-[rgba(59,167,118,0.24)]",
  warning:
    "bg-[rgba(176,137,63,0.16)] text-[color:var(--pq-color-ivory-100)] border-[rgba(176,137,63,0.24)]",
  danger:
    "bg-[rgba(183,92,92,0.16)] text-[color:var(--pq-color-ivory-100)] border-[rgba(183,92,92,0.24)]",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em]",
        toneClassMap[tone],
        className,
      )}
      {...props}
    />
  );
}
