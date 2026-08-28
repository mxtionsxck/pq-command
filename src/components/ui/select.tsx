import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type SelectOption = Readonly<{
  label: string;
  value: string;
}>;

type SelectProps = Readonly<{
  label: string;
  options: readonly SelectOption[];
  hint?: string;
}> &
  SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
  className,
  hint,
  id,
  label,
  options,
  ...props
}: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block space-y-2" htmlFor={selectId}>
      <span className="text-sm font-medium text-[color:var(--pq-color-ivory-100)]">
        {label}
      </span>
      <select
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        className={cn(
          "min-h-12 w-full rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] bg-[color:var(--pq-surface)] px-4 text-[color:var(--pq-text)]",
          className,
        )}
        id={selectId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span className="block text-sm pq-copy-subtle" id={`${selectId}-hint`}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
