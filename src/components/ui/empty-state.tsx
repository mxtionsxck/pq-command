import type { ReactNode } from "react";

import { Button } from "./button";

type EmptyStateProps = Readonly<{
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}>;

export function EmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: EmptyStateProps) {
  return (
    <section className="pq-panel rounded-[var(--pq-radius-lg)] px-6 py-10 text-center sm:px-10">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4">
        {icon ? (
          <div className="flex size-14 items-center justify-center rounded-full bg-white/6 text-[color:var(--pq-accent-strong)]">
            {icon}
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-white">{title}</h3>
          <p className="pq-copy-muted text-sm leading-6">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </div>
    </section>
  );
}
