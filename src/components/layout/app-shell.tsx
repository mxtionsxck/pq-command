import type { ReactNode } from "react";
import Link from "next/link";

import { PqLogo } from "./pq-logo";

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen px-3 py-4 sm:px-6 sm:py-8 lg:px-10 lg:py-10" id="main-content" tabIndex={-1}>
      <div className="mx-auto max-w-[92rem] rounded-[calc(var(--pq-radius-xl)+0.25rem)] border border-[color:var(--pq-border)] bg-[color:var(--pq-background-elevated)] p-4 shadow-[var(--pq-shadow-panel)] backdrop-blur sm:p-7 lg:p-10">
        <div className="rounded-[var(--pq-radius-xl)] border border-[rgba(215,192,140,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.005))] p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[color:rgba(215,192,140,0.12)] pb-4">
            <Link href="/" className="inline-flex items-center">
              <PqLogo compact />
            </Link>
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--pq-text-subtle)]">
              Institutional Operating Interface
            </p>
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
