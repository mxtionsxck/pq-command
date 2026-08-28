import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, Card, EmptyState, Table } from "@/components/ui";
import { requireCurrentUserPermission } from "@/server/auth/session";

const managementColumns = [
  { key: "capability", header: "Capability" },
  { key: "state", header: "Current state" },
] as const;

const managementRows = [
  {
    capability: "Directory-backed role sync",
    state: "Pending provider environment configuration",
  },
  {
    capability: "User invitation flow",
    state: "Intentionally unimplemented",
  },
  {
    capability: "Role review audit trail",
    state: "Reserved for future persistence layer",
  },
] as const;

export default async function AdminUsersPage() {
  const user = await requireCurrentUserPermission("manageUsers");

  return (
    <AppShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin"
          title="User management"
          description="Skeleton only. Production users remain disconnected until auth environment variables and directory strategy are configured."
        />

        <div className="flex flex-wrap gap-3">
          <Badge tone="success">Signed in as {user.role}</Badge>
          <Badge tone="warning">No production user sync yet</Badge>
        </div>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card eyebrow="Access model" title="Admin-only operations scaffold">
            <Table
              caption="Admin user management skeleton state"
              columns={managementColumns}
              rows={managementRows}
            />
          </Card>

          <EmptyState
            description="PQ COMMAND does not create or store user passwords. Identity remains with Microsoft Entra ID, and admin workflows stay disabled until the environment is configured."
            title="Directory integration not connected"
          />
        </section>
      </div>
    </AppShell>
  );
}
