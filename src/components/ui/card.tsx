import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardProps = Readonly<{
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}> &
  HTMLAttributes<HTMLElement>;

export function Card({
  actions,
  children,
  className,
  eyebrow,
  footer,
  title,
  ...props
}: CardProps) {
  return (
    <article
      className={cn(
        "pq-panel overflow-hidden rounded-[var(--pq-radius-lg)] p-5 sm:p-6",
        className,
      )}
      {...props}
    >
      {eyebrow || title || actions ? (
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-[color:rgba(215,192,140,0.08)] pb-4">
          <div className="space-y-2">
            {eyebrow ? <p className="pq-kicker">{eyebrow}</p> : null}
            {title ? (
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">{title}</h3>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div>{children}</div>
      {footer ? (
        <footer className="mt-5 border-t border-[color:rgba(215,192,140,0.08)] pt-4">{footer}</footer>
      ) : null}
    </article>
  );
}
