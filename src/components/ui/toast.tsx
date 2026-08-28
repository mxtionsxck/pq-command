"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Button } from "./button";
import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/design-tokens";

type ToastItem = Readonly<{
  id: number;
  title: string;
  description?: string;
  tone: StatusTone;
}>;

type ToastContextValue = Readonly<{
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
}>;

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClassMap: Record<StatusTone, string> = {
  neutral: "border-white/10 bg-[color:var(--pq-background-elevated)]",
  info: "border-[rgba(111,143,181,0.35)] bg-[rgba(111,143,181,0.14)]",
  success: "border-[rgba(59,167,118,0.35)] bg-[rgba(59,167,118,0.14)]",
  warning: "border-[rgba(176,137,63,0.35)] bg-[rgba(176,137,63,0.14)]",
  danger: "border-[rgba(183,92,92,0.35)] bg-[rgba(183,92,92,0.14)]",
};

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast: (toast) => {
        setToasts((current) => [
          ...current,
          {
            ...toast,
            id: Date.now() + current.length,
          },
        ]);
      },
      dismissToast: (id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-3 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <section
            className={cn(
              "pointer-events-auto rounded-[var(--pq-radius-md)] border p-4 shadow-2xl transition-transform duration-200 motion-reduce:transition-none",
              toneClassMap[toast.tone],
            )}
            key={toast.id}
            role="status"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="pq-copy-muted text-sm">{toast.description}</p>
                ) : null}
              </div>
              <Button
                onClick={() => value.dismissToast(toast.id)}
                size="sm"
                variant="ghost"
              >
                Dismiss
              </Button>
            </div>
          </section>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
