import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = Readonly<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}> &
  ButtonHTMLAttributes<HTMLButtonElement>;

const sizeClassMap: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    "border-[color:var(--pq-border-strong)] bg-[linear-gradient(180deg,var(--pq-accent-strong),var(--pq-accent))] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-105",
  secondary:
    "border-[color:rgba(215,192,140,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] text-[color:var(--pq-color-white)] hover:border-[color:var(--pq-border-strong)] hover:bg-[color:var(--pq-surface-strong)]",
  ghost:
    "border-[color:transparent] bg-transparent text-[color:var(--pq-text-muted)] hover:border-[color:rgba(215,192,140,0.14)] hover:bg-white/6 hover:text-white",
};

export function Button({
  children,
  className,
  leadingIcon,
  size = "md",
  trailingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--pq-radius-sm)] border font-medium tracking-[0.02em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
        sizeClassMap[size],
        variantClassMap[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
}
