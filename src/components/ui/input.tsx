import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type InputProps = Readonly<{
  label: string;
  hint?: string;
  error?: string;
}> &
  InputHTMLAttributes<HTMLInputElement>;

export function Input({
  className,
  error,
  hint,
  id,
  label,
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  return (
    <label className="block space-y-2" htmlFor={inputId}>
      <span className="text-sm font-medium text-[color:var(--pq-color-ivory-100)]">
        {label}
      </span>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={cn(
          "min-h-12 w-full rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-[color:var(--pq-surface)] px-4 text-[color:var(--pq-text)] placeholder:text-[color:var(--pq-text-subtle)]",
          error ? "border-[rgba(183,92,92,0.6)]" : "",
          className,
        )}
        id={inputId}
        {...props}
      />
      {hint && !error ? (
        <span className="block text-sm pq-copy-subtle" id={`${inputId}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span
          className="block text-sm text-[color:var(--pq-color-ivory-100)]"
          id={`${inputId}-error`}
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}
