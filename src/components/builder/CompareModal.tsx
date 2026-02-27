"use client";

// ---------------------------------------------------------------------------
// CompareModal — side-by-side comparison of up to 3 strategy candidates
// ---------------------------------------------------------------------------

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import dynamic from "next/dynamic";
import type { RecommendedStrategy } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

const PayoffChart = dynamic(() => import("@/components/chart/PayoffChart"), {
  ssr: false,
  loading: () => <div className="h-28 animate-pulse rounded bg-surface-800" />,
});

interface CompareModalProps {
  open: boolean;
  onClose: () => void;
  candidates: RecommendedStrategy[];
  spot: number;
}

const BIAS_COLORS: Record<string, string> = {
  bullish:  "text-bull",
  bearish:  "text-bear",
  neutral:  "text-slate-400",
  volatile: "text-amber-400",
};

function CompareColumn({
  candidate,
  spot,
}: {
  candidate: RecommendedStrategy;
  spot: number;
}) {
  const { strategy, netDebitCredit, maxGain, maxLoss, breakevens, simulation, fit, fitScore } =
    candidate;

  const costStr =
    netDebitCredit < 0
      ? `-$${Math.abs(netDebitCredit).toFixed(2)}`
      : `+$${netDebitCredit.toFixed(2)}`;

  const popStr = simulation ? `${(simulation.pop * 100).toFixed(0)}%` : "—";
  const evStr =
    simulation
      ? `${simulation.ev >= 0 ? "+" : ""}$${simulation.ev.toFixed(0)}`
      : "—";

  const rows: { label: string; value: string; highlight?: string }[] = [
    { label: "Cost", value: costStr },
    {
      label: "Max gain",
      value: maxGain != null ? formatPrice(maxGain) : "Unlimited",
      highlight: "text-bull",
    },
    {
      label: "Max loss",
      value: maxLoss != null ? formatPrice(Math.abs(maxLoss)) : "Unlimited",
      highlight: maxLoss != null ? undefined : "text-bear",
    },
    {
      label: "Breakeven",
      value:
        breakevens.length > 0
          ? breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ")
          : "—",
    },
    { label: "PoP", value: popStr, highlight: "text-brand-400" },
    { label: "EV", value: evStr },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {/* Title */}
      <div>
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            BIAS_COLORS[strategy.bias]
          )}
        >
          {strategy.bias}
        </p>
        <p className="text-sm font-semibold text-white leading-tight">{strategy.name}</p>
        <span
          className={cn(
            "mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
            fit === "strong"
              ? "border-brand-700 bg-brand-900/30 text-brand-400"
              : "border-surface-700 bg-surface-800 text-slate-400"
          )}
        >
          {fit === "strong" ? "Strong" : "Moderate"} · {fitScore}
        </span>
      </div>

      {/* Payoff chart */}
      <div className="overflow-hidden rounded-lg bg-surface-800/50">
        <PayoffChart legs={strategy.legs} spot={spot} height={100} />
      </div>

      {/* Metrics */}
      <div className="space-y-1.5 rounded-xl border border-surface-700 bg-surface-900 p-2">
        {rows.map(({ label, value, highlight }) => (
          <div key={label} className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{label}</span>
            <span className={cn("font-mono", highlight ?? "text-slate-200")}>{value}</span>
          </div>
        ))}
      </div>

      {/* Legs */}
      <div className="space-y-0.5 rounded-xl border border-surface-700 bg-surface-900 p-2">
        <p className="mb-1 text-[10px] font-semibold text-slate-500">Legs</p>
        {strategy.legs.map((leg, i) => (
          <div key={i} className="flex justify-between text-[11px]">
            <span className={leg.side === "long" ? "text-bull" : "text-bear"}>
              {leg.side === "long" ? "+" : "−"}{leg.qty}× {leg.type} ${leg.strike}
            </span>
            <span className="text-slate-500 font-mono">${leg.premium.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CompareModal({
  open,
  onClose,
  candidates,
  spot,
}: CompareModalProps) {
  if (candidates.length < 2) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Strategy Comparison</DialogTitle>
          <DialogDescription>
            Side-by-side comparison of {candidates.length} selected strategies.
            Not a recommendation — review all risks carefully.
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "mt-1 grid gap-4",
            candidates.length === 2 ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          {candidates.map((c) => (
            <CompareColumn key={c.id} candidate={c} spot={spot} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
