"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast } from "@/hooks/use-toast";

interface ToastItemProps extends Toast {
  onDismiss: (id: string) => void;
}

export function ToastItem({ id, title, description, variant = "default", onDismiss }: ToastItemProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
        "animate-in slide-in-from-right-full fade-in duration-300",
        variant === "destructive"
          ? "border-red-800 bg-red-950 text-red-100"
          : "border-surface-700 bg-surface-900 text-slate-100"
      )}
    >
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-xs text-slate-400">{description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
