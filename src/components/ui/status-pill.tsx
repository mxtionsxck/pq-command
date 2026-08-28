import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/design-tokens";

type StatusPillProps = Readonly<{
  tone?: StatusTone;
}> &
  HTMLAttributes<HTMLSpanElement>;

const toneClassMap: Record<StatusTone, string> = {
  neutral: "bg-[rgba(215,192,140,0.08)] text-[color:var(--pq-text-muted)] border-[rgba(215,192,140,0.12)]",
  info: "bg-[rgba(111,143,181,0.18)] text-white",
  success: "bg-[rgba(59,167,118,0.18)] text-white",
  warning: "bg-[rgba(176,137,63,0.18)] text-white",
  danger: "bg-[rgba(183,92,92,0.18)] text-white",
};

export function StatusPill({
  className,
  tone = "neutral",
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        toneClassMap[tone],
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-current opacity-75"
      />
      <span>{props.children}</span>
    </span>
  );
}
