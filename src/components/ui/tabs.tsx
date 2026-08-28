"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/cn";

type TabItem = Readonly<{
  value: string;
  label: string;
  content: React.ReactNode;
}>;

type TabsProps = Readonly<{
  items: readonly TabItem[];
  label: string;
  defaultValue?: string;
}>;

export function Tabs({ defaultValue, items, label }: TabsProps) {
  const generatedId = useId();
  const [activeValue, setActiveValue] = useState(
    defaultValue ?? items[0]?.value ?? "",
  );

  return (
    <div className="space-y-4">
      <div
        aria-label={label}
        className="inline-flex w-full flex-wrap gap-2 rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] bg-[color:var(--pq-surface)] p-2"
        role="tablist"
      >
        {items.map((item) => {
          const isActive = item.value === activeValue;

          return (
            <button
              aria-controls={`${generatedId}-${item.value}-panel`}
              aria-selected={isActive}
              className={cn(
                "rounded-[calc(var(--pq-radius-md)-0.25rem)] px-4 py-2 text-sm font-medium transition-colors duration-200",
                isActive
                  ? "bg-[color:var(--pq-accent)] text-black"
                  : "text-[color:var(--pq-text-muted)] hover:bg-white/6 hover:text-white",
              )}
              id={`${generatedId}-${item.value}-tab`}
              key={item.value}
              onClick={() => setActiveValue(item.value)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => {
        const isActive = item.value === activeValue;

        return (
          <div
            aria-labelledby={`${generatedId}-${item.value}-tab`}
            className={isActive ? "block" : "hidden"}
            id={`${generatedId}-${item.value}-panel`}
            key={item.value}
            role="tabpanel"
            tabIndex={0}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
