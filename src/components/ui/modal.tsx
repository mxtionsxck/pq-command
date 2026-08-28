"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "./button";

type ModalProps = Readonly<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}>;

export function Modal({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: ModalProps) {
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
      className="w-[min(92vw,38rem)] rounded-[var(--pq-radius-xl)]"
      onCancel={onClose}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="pq-panel rounded-[var(--pq-radius-xl)] p-6 sm:p-8">
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
        <div>{children}</div>
        {footer ? (
          <div className="mt-6 border-t pq-hairline pt-4">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}
