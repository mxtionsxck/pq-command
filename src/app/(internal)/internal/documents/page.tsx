import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createDocumentControlService } from "@/server/services/document-control-service";

export default async function DocumentsPage() {
  await requireCurrentUserPermission("sendOutreach");

  if (!getDatabaseConfig(appEnv).configured) {
    return (
      <AppShell>
        <EmptyState
          title="Documents unavailable"
          description="Configure DATABASE_URL to manage document operations."
        />
      </AppShell>
    );
  }

  const service = createDocumentControlService();
  const [recentResult, coverageResult] = await Promise.allSettled([
    service.listRecentDocuments(),
    service.listDealCoverage(),
  ]);

  const recent = recentResult.status === "fulfilled" ? recentResult.value : [];
  const coverage = coverageResult.status === "fulfilled" ? coverageResult.value : [];

  if (recentResult.status === "rejected") {
    console.error("Document control recent documents failed:", recentResult.reason);
  }
  if (coverageResult.status === "rejected") {
    console.error("Document control coverage failed:", coverageResult.reason);
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Operations"
          title="Document Control"
          description="Recent documents plus deal-level coverage for contract/compliance/floorplan readiness."
        />

        <Card title="Deal document coverage" eyebrow={`${coverage.length} active deal(s)`}>
          {coverage.length === 0 ? (
            <EmptyState
              title="No deal document coverage"
              description="Deals in AGREED/CONTRACT/LIVE/COMPLETED stages will show here."
            />
          ) : (
            <div className="space-y-3">
              {coverage.map((row) => {
                const ready = row.contractDocs > 0 && row.complianceDocs > 0;

                return (
                  <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={row.dealId}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-white">Deal {row.dealId}</p>
                      <Badge tone={ready ? "success" : "warning"}>{ready ? "READY" : "MISSING DOCS"}</Badge>
                    </div>
                    <p className="mt-1 text-xs pq-copy-muted">
                      status {row.status} | total {row.totalDocs} | contract {row.contractDocs} | compliance {row.complianceDocs} | floorplan {row.floorplanDocs}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Recent documents" eyebrow={`${recent.length} file(s)`}>
          {recent.length === 0 ? (
            <EmptyState title="No recent documents" description="Upload documents from property rooms to populate this view." />
          ) : (
            <div className="space-y-3">
              {recent.map((document) => (
                <article className="rounded-[var(--pq-radius-sm)] border border-[color:var(--pq-border)] p-3" key={document.id}>
                  <p className="text-sm text-white">{document.title}</p>
                  <p className="mt-1 text-xs pq-copy-muted">
                    {document.documentType} | status {document.status} | v{document.versionNumber}
                  </p>
                  {document.propertyId ? (
                    <Link className="mt-2 inline-flex text-xs text-[color:var(--pq-accent-strong)]" href={`/internal/stock-room/${document.propertyId}`}>
                      Open property room
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
