import type { ReactNode } from "react";

import { Button } from "./button";
import { cn } from "@/lib/cn";

type CommandBarProps = Readonly<{
  title: string;
  hint: string;
  actions?: readonly ReactNode[];
  className?: string;
}>;

export function CommandBar({
  actions = [],
  className,
  hint,
  title,
}: CommandBarProps) {
  return (
    <form
      aria-label={title}
      className={cn(
        "pq-panel flex flex-col gap-4 rounded-[var(--pq-radius-lg)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        className,
      )}
      role="search"
    >
      <div className="space-y-2">
        <p className="pq-kicker">Command bar</p>
        <label className="block">
          <span className="sr-only">Search command input</span>
          <input
            className="min-h-12 w-full rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-black/30 px-4 text-sm text-white placeholder:text-[color:var(--pq-text-subtle)] sm:min-w-80"
            placeholder={hint}
            type="search"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => (
          <div key={index}>{action}</div>
        ))}
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </div>
    </form>
  );
}
