import { AppShell } from "@/components/layout/app-shell";
import { Card, Skeleton } from "@/components/ui";

export default function StockRoomLoading() {
  return (
    <AppShell>
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Card>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-[var(--pq-radius-sm)]" />
            <Skeleton className="h-32 w-full rounded-[var(--pq-radius-md)]" />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
