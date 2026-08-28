"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button, Card } from "@/components/ui";

export default function StockRoomError({
  error,
  reset,
}: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  return (
    <AppShell>
      <Card eyebrow="Error" title="Stock Room unavailable">
        <div className="space-y-4 text-sm">
          <p className="pq-copy-muted">{error.message}</p>
          <Button onClick={reset} variant="secondary">
            Retry
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
