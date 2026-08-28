"use client";

import { Button } from "./button";
import { Modal } from "./modal";

type ConfirmDialogProps = Readonly<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}>;

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  onClose,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  return (
    <Modal
      description={description}
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button onClick={onClose} variant="ghost">
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      }
      onClose={onClose}
      open={open}
      title={title}
    >
      <p className="pq-copy-muted text-sm leading-6">
        Confirmations use the same modal surface and focus treatment as every
        other overlay.
      </p>
    </Modal>
  );
}
