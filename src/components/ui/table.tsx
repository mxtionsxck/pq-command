import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type TableColumn<T> = Readonly<{
  key: keyof T;
  header: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
}>;

type TableProps<T extends Record<string, ReactNode | string>> = Readonly<{
  caption: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
}>;

export function Table<T extends Record<string, ReactNode | string>>({
  caption,
  columns,
  rows,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-[var(--pq-radius-lg)] border border-[color:var(--pq-border)]">
      <table className="min-w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-white/5">
          <tr>
            {columns.map((column) => (
              <th
                className={cn(
                  "px-4 py-3 text-sm font-medium text-[color:var(--pq-text-muted)]",
                  column.align === "right" ? "text-right" : "text-left",
                )}
                key={String(column.key)}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              className="border-t border-[color:var(--pq-border)]"
              key={index}
            >
              {columns.map((column) => (
                <td
                  className={cn(
                    "px-4 py-3 text-sm text-[color:var(--pq-color-ivory-100)]",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                  key={String(column.key)}
                >
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
