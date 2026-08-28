import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { AuditTimeline, Badge, Card, EmptyState } from "@/components/ui";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import { requireCurrentUserPermission } from "@/server/auth/session";
import { createAuditService } from "@/server/services/audit-event-service";

export default async function AdminAuditPage() {
  await requireCurrentUserPermission("manageAuditHistory");

  const database = getDatabaseConfig(appEnv);

  if (!database.configured) {
    return (
      <AppShell>
        <div className="space-y-8">
          <PageHeader
            eyebrow="Admin"
            title="Audit history"
            description="Audit viewing is ready, but the database is not configured in this environment."
          />
          <EmptyState
            description="Configure DATABASE_URL to persist and inspect audit events. Sensitive payloads remain redacted by the audit service."
            title="Audit database unavailable"
          />
        </div>
      </AppShell>
    );
  }

  const auditService = createAuditService();
  const events = await auditService.listRecent({ limit: 100 });

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="Audit history"
          description="Immutable operational history for privileged review. Ordinary agents cannot manage audit history."
        />

        <div className="flex flex-wrap gap-3">
          <Badge tone="success">{events.length} event(s)</Badge>
          <Badge tone="info">Sanitized metadata</Badge>
        </div>

        {events.length === 0 ? (
          <EmptyState
            description="No audit events have been recorded in this environment yet."
            title="Audit history is empty"
          />
        ) : (
          <Card eyebrow="Audit" title="Recent mutations">
            <AuditTimeline events={events} />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
