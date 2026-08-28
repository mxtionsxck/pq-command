"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "./button";

type DrawerProps = Readonly<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}>;

export function Drawer({
  children,
  description,
  onClose,
  open,
  title,
}: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      className="ml-auto mr-0 h-full w-[min(92vw,30rem)]"
      onCancel={onClose}
      onClose={onClose}
      ref={dialogRef}
    >
      <aside className="pq-panel h-full rounded-l-[var(--pq-radius-xl)] p-6 sm:p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="pq-copy-muted text-sm leading-6" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <Button onClick={onClose} variant="ghost">
            Close
          </Button>
        </header>
        <div className="pq-scrollbar h-[calc(100%-4rem)] overflow-y-auto pr-1">
          {children}
        </div>
      </aside>
    </dialog>
  );
}
