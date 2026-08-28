import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type IconButtonProps = Readonly<{
  icon: ReactNode;
  label: string;
}> &
  ButtonHTMLAttributes<HTMLButtonElement>;

export function IconButton({
  className,
  icon,
  label,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full border border-[color:var(--pq-border)] bg-[color:var(--pq-surface)] text-[color:var(--pq-color-white)] transition-colors duration-200 hover:bg-[color:var(--pq-surface-strong)] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      type={type}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
