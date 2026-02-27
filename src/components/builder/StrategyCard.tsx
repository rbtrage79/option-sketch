"use client";

// ---------------------------------------------------------------------------
// StrategyCard — displays a single recommended strategy candidate
// ---------------------------------------------------------------------------

import React, { useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, Zap,
  ChevronDown, ChevronUp, CheckSquare, Square,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import type { RecommendedStrategy } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

const PayoffChart = dynamic(() => import("@/components/chart/PayoffChart"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded bg-surface-800" />,
});

interface StrategyCardProps {
  candidate: RecommendedStrategy;
  spot: number;
  isSelected: boolean;
  onToggleCompare: (id: string) => void;
  compareDisabled: boolean; // true when 3 are already selected and this is not one
}

const BIAS_CONFIG = {
  bullish:  { label: "Bullish",  color: "text-bull",  bg: "bg-bull/10 border-bull/30",  Icon: TrendingUp },
  bearish:  { label: "Bearish",  color: "text-bear",  bg: "bg-bear/10 border-bear/30",  Icon: TrendingDown },
  neutral:  { label: "Neutral",  color: "text-slate-400", bg: "bg-slate-800 border-slate-700", Icon: Minus },
  volatile: { label: "Volatile", color: "text-amber-400", bg: "bg-amber-900/20 border-amber-800/40", Icon: Zap },
} as const;

function FitBadge({ fit, score }: { fit: RecommendedStrategy["fit"]; score: number }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        fit === "strong"
          ? "border-brand-700 bg-brand-900/30 text-brand-400"
          : "border-surface-600 bg-surface-800 text-slate-400"
      )}
    >
      {fit === "strong" ? "Strong fit" : "Moderate fit"} · {score}
    </span>
  );
}

function MetricRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-mono", muted ? "text-slate-500" : "text-slate-200")}>
        {value}
      </span>
    </div>
  );
}

export default function StrategyCard({
  candidate,
  spot,
  isSelected,
  onToggleCompare,
  compareDisabled,
}: StrategyCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { strategy, netDebitCredit, maxGain, maxLoss, breakevens, rationale, risks, fit, fitScore, simulation } =
    candidate;

  const cfg = BIAS_CONFIG[strategy.bias];
  const Icon = cfg.Icon;

  const costLabel =
    netDebitCredit < 0
      ? `Debit $${Math.abs(netDebitCredit).toFixed(2)}`
      : `Credit $${netDebitCredit.toFixed(2)}`;

  const maxGainStr = maxGain != null ? formatPrice(maxGain) : "Unlimited";
  const maxLossStr = maxLoss != null ? formatPrice(Math.abs(maxLoss)) : "Unlimited";

  const popStr = simulation != null ? `${(simulation.pop * 100).toFixed(0)}%` : "—";
  const evStr =
    simulation != null
      ? `${simulation.ev >= 0 ? "+" : ""}$${simulation.ev.toFixed(0)}`
      : "—";

  return (
    <Card
      className={cn(
        "border transition-colors",
        isSelected ? "border-brand-500 ring-1 ring-brand-500/50" : "border-surface-700"
      )}
    >
      <CardContent className="p-3">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  cfg.bg,
                  cfg.color
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {cfg.label}
              </span>
              <FitBadge fit={fit} score={fitScore} />
            </div>
            <h3 className="mt-1 text-sm font-semibold text-white leading-tight">
              {strategy.name}
            </h3>
          </div>

          {/* Compare toggle */}
          <button
            onClick={() => onToggleCompare(candidate.id)}
            disabled={compareDisabled && !isSelected}
            className={cn(
              "shrink-0 transition-opacity",
              compareDisabled && !isSelected ? "opacity-30 cursor-not-allowed" : "hover:opacity-80"
            )}
            title={isSelected ? "Remove from compare" : "Add to compare"}
          >
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-brand-400" />
            ) : (
              <Square className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>

        {/* ── Key metrics ─────────────────────────────────────────────────── */}
        <div className="mb-2 space-y-1">
          <MetricRow label="Cost" value={costLabel} />
          <MetricRow label="Max gain" value={maxGainStr} />
          <MetricRow label="Max loss" value={maxLossStr} />
          {breakevens.length > 0 && (
            <MetricRow
              label="Breakeven"
              value={breakevens.map((b) => formatPrice(b)).join(" / ")}
            />
          )}
          <div className="flex gap-3">
            <MetricRow
              label="PoP"
              value={simulation ? popStr : "simulating…"}
              muted={!simulation}
            />
            <MetricRow
              label="EV"
              value={simulation ? evStr : "—"}
              muted={!simulation}
            />
          </div>
        </div>

        {/* ── Mini payoff chart ────────────────────────────────────────────── */}
        <div className="mb-2 overflow-hidden rounded-lg bg-surface-800/50">
          <PayoffChart legs={strategy.legs} spot={spot} height={90} />
        </div>

        {/* ── Rationale expand/collapse ────────────────────────────────────── */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between text-[10px] text-slate-500 hover:text-slate-400"
        >
          <span>Why this strategy?</span>
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            <ul className="space-y-1">
              {rationale.map((bullet, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] text-slate-400">
                  <span className="mt-0.5 shrink-0 text-brand-500">•</span>
                  {bullet}
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-amber-900/30 bg-amber-900/10 p-2">
              <p className="mb-1 text-[10px] font-semibold text-amber-500">Risks</p>
              <ul className="space-y-0.5">
                {risks.map((risk, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] text-amber-400/70">
                    <span className="shrink-0">⚠</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>

            {/* Legs summary */}
            <div className="space-y-0.5">
              <p className="text-[10px] font-semibold text-slate-500">Legs</p>
              {strategy.legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className={cn(leg.side === "long" ? "text-bull" : "text-bear")}>
                    {leg.side === "long" ? "+" : "−"} {leg.qty}×{" "}
                    {leg.type === "call" ? "Call" : "Put"} ${leg.strike}
                  </span>
                  <span className="text-slate-500 font-mono">${leg.premium.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
