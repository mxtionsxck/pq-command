import { AppShell } from "../components/layout/app-shell";
import { PageHeader } from "../components/layout/page-header";
import { DesignSystemDemo } from "../components/ui/design-system-demo";
import { Badge } from "../components/ui";

export default function Home() {
  return (
    <AppShell>
      <div className="space-y-10">
        <PageHeader
          eyebrow="PQ REAL ESTATE"
          title="PQ COMMAND"
          description="Token-driven internal design system for premium, calm, accessible operational interfaces."
        />
        <div className="flex flex-wrap gap-3">
          <Badge tone="success">Phase 2</Badge>
          <Badge tone="info">Reusable primitives</Badge>
          <Badge tone="warning">No business screens yet</Badge>
        </div>
        <DesignSystemDemo />
      </div>
    </AppShell>
  );
}
