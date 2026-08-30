"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { PqLogo } from "./pq-logo";

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isInternalSurface =
    pathname.startsWith("/internal") || pathname.startsWith("/admin");

  const primaryNav = [
    { href: "/internal/command-centre", label: "Command Centre" },
    { href: "/internal/leads?view=qualified", label: "Qualified Leads" },
    { href: "/internal/inbox", label: "Inbox" },
    { href: "/internal/acquisition", label: "Acquisition" },
    { href: "/internal/deals", label: "Deals" },
    { href: "/internal/viewings", label: "Viewings" },
  ] as const;

  const secondaryNav = [
    { href: "/internal/stock-room", label: "Stock" },
    { href: "/internal/demand-room", label: "Demand" },
    { href: "/internal/outreach", label: "Outreach" },
    { href: "/admin/operations", label: "System" },
  ] as const;

  const isActive = (href: string) => {
    const [basePath] = href.split("?");
    return pathname === basePath || pathname.startsWith(`${basePath}/`);
  };

  const shellPadding = isInternalSurface ? "pb-24 md:pb-8" : "";

  return (
    <main className={`min-h-screen px-3 py-4 sm:px-6 sm:py-8 lg:px-10 lg:py-10 ${shellPadding}`} id="main-content" tabIndex={-1}>
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

          {isInternalSurface ? (
            <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
              <aside className="hidden lg:block">
                <div className="sticky top-6 rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] bg-black/20 p-3">
                  <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.18em] pq-copy-subtle">
                    Quick Navigation
                  </p>
                  <nav className="space-y-1" aria-label="Primary internal navigation">
                    {primaryNav.map((item) => (
                      <Link
                        className={`flex min-h-11 items-center rounded-[var(--pq-radius-sm)] px-3 text-sm transition ${isActive(item.href) ? "bg-[color:var(--pq-accent)] text-black" : "text-white hover:bg-white/10"}`}
                        href={item.href}
                        key={item.href}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-3 border-t border-[color:var(--pq-border)] pt-3">
                    <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.18em] pq-copy-subtle">
                      More
                    </p>
                    <nav className="space-y-1" aria-label="Secondary internal navigation">
                      {secondaryNav.map((item) => (
                        <Link
                          className={`flex min-h-11 items-center rounded-[var(--pq-radius-sm)] px-3 text-sm transition ${isActive(item.href) ? "bg-[color:var(--pq-accent)] text-black" : "text-white hover:bg-white/10"}`}
                          href={item.href}
                          key={item.href}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                </div>
              </aside>
              <div>{children}</div>
            </div>
          ) : (
            children
          )}

          {isInternalSurface ? (
            <nav
              aria-label="Mobile internal navigation"
              className="fixed inset-x-3 bottom-3 z-50 rounded-[var(--pq-radius-md)] border border-[color:var(--pq-border)] bg-[color:var(--pq-background-elevated)] p-2 shadow-[var(--pq-shadow-panel)] backdrop-blur lg:hidden"
            >
              <div className="grid grid-cols-4 gap-2">
                {primaryNav.slice(0, 4).map((item) => (
                  <Link
                    className={`flex min-h-12 items-center justify-center rounded-[var(--pq-radius-sm)] px-2 text-center text-xs font-medium leading-tight ${isActive(item.href) ? "bg-[color:var(--pq-accent)] text-black" : "text-white"}`}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  );
}
