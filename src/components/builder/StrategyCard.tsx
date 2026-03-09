"use client";

// ---------------------------------------------------------------------------
// StrategyCard — displays a single recommended strategy candidate
//
// Shows:
//  • Exact contracts (ticker · expiry · each leg with strike/premium/total)
//  • P/L wealth curve at ±5 / ±10 / ±15 / ±20 % moves at expiry
//  • PoP + EV simulation metrics
//  • Expandable section: payoff chart + rationale + risks
// ---------------------------------------------------------------------------

import React, { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Minus, Zap,
  ChevronDown, ChevronUp, CheckSquare, Square,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import dynamic from "next/dynamic";
import type { RecommendedStrategy } from "@/lib/types";
import { cn, formatPrice, formatDate } from "@/lib/utils";
import { strategyPayoffAtExpiry } from "@/lib/payoff";
import { useStore } from "@/lib/store";

const PayoffChart = dynamic(() => import("@/components/chart/PayoffChart"), {
  ssr: false,
  loading: () => <div className="h-24 animate-pulse rounded bg-surface-800" />,
});

// ── Move percentages for the wealth table ──────────────────────────────────
const MOVE_PCTS = [-20, -15, -10, -5, 0, 5, 10, 15, 20] as const;

interface StrategyCardProps {
  candidate: RecommendedStrategy;
  spot: number;
  isSelected: boolean;
  onToggleCompare: (id: string) => void;
  compareDisabled: boolean;
}

const BIAS_CONFIG = {
  bullish:  { label: "Bullish",  color: "text-bull",       bg: "bg-bull/10 border-bull/30",           Icon: TrendingUp  },
  bearish:  { label: "Bearish",  color: "text-bear",       bg: "bg-bear/10 border-bear/30",           Icon: TrendingDown },
  neutral:  { label: "Neutral",  color: "text-slate-400",  bg: "bg-slate-800 border-slate-700",       Icon: Minus       },
  volatile: { label: "Volatile", color: "text-amber-400",  bg: "bg-amber-900/20 border-amber-800/40", Icon: Zap         },
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

export default function StrategyCard({
  candidate,
  spot,
  isSelected,
  onToggleCompare,
  compareDisabled,
}: StrategyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { selectedSymbol } = useStore();

  const {
    strategy, netDebitCredit, maxGain, maxLoss, breakevens,
    rationale, risks, fit, fitScore, simulation,
  } = candidate;

  const cfg = BIAS_CONFIG[strategy.bias];
  const Icon = cfg.Icon;

  // All legs share the same expiry for our built strategies
  const expiry = strategy.legs[0]?.expiry ?? "";

  const maxGainStr = maxGain != null ? formatPrice(maxGain) : "Unlimited";
  const maxLossStr = maxLoss != null ? formatPrice(Math.abs(maxLoss)) : "Unlimited";

  const popStr = simulation != null ? `${(simulation.pop * 100).toFixed(0)}%` : "—";
  const evStr  = simulation != null
    ? `${simulation.ev >= 0 ? "+" : ""}$${Math.abs(simulation.ev).toFixed(0)}`
    : "—";

  // ── P/L wealth table at each move percentage ──────────────────────────────
  const wealthRows = useMemo(
    () =>
      MOVE_PCTS.map((pct) => {
        const price = spot * (1 + pct / 100);
        const pnl   = strategyPayoffAtExpiry(strategy.legs, price);
        return { pct, price: +price.toFixed(2), pnl: +pnl.toFixed(0) };
      }),
    [strategy.legs, spot]
  );

  function fmtPnl(pnl: number): string {
    const abs = Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 });
    return pnl >= 0 ? `+$${abs}` : `-$${abs}`;
  }

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
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  cfg.bg, cfg.color
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {cfg.label}
              </span>
              <FitBadge fit={fit} score={fitScore} />
            </div>
            <h3 className="mt-1 text-sm font-semibold leading-tight text-white">
              {strategy.name}
            </h3>
          </div>

          {/* Compare toggle */}
          <button
            onClick={() => onToggleCompare(candidate.id)}
            disabled={compareDisabled && !isSelected}
            className={cn(
              "shrink-0 transition-opacity",
              compareDisabled && !isSelected ? "cursor-not-allowed opacity-30" : "hover:opacity-80"
            )}
            title={isSelected ? "Remove from compare" : "Add to compare"}
          >
            {isSelected
              ? <CheckSquare className="h-4 w-4 text-brand-400" />
              : <Square      className="h-4 w-4 text-slate-600" />
            }
          </button>
        </div>

        {/* ── Contract details ─────────────────────────────────────────────── */}
        <div className="mb-3 rounded-lg border border-surface-700 bg-surface-800/60 p-2 text-[11px]">
          {/* Ticker + expiry row */}
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono font-bold text-white">{selectedSymbol}</span>
            <span className="text-slate-400">
              Exp&nbsp;
              <span className="font-medium text-slate-200">{formatDate(expiry)}</span>
            </span>
          </div>

          {/* Each leg */}
          <div className="space-y-0.5">
            {strategy.legs.map((leg, i) => {
              const total = leg.premium * 100 * leg.qty;
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      leg.side === "long" ? "text-bull" : "text-bear"
                    )}
                  >
                    {leg.side === "long" ? "+" : "−"}
                    {leg.qty}×&nbsp;
                    {leg.type === "call" ? "Call" : "Put"}&nbsp;
                    <span className="text-white">${leg.strike}</span>
                  </span>
                  <span className="text-right text-slate-400">
                    <span className="font-mono text-slate-200">${leg.premium.toFixed(2)}</span>
                    <span className="text-slate-600">/sh</span>
                    <span className="ml-1 text-slate-500">(${total.toFixed(0)})</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Net debit / credit */}
          <div className="mt-1.5 flex items-center justify-between border-t border-surface-700/60 pt-1.5">
            <span className="text-slate-500">
              Net {netDebitCredit <= 0 ? "debit" : "credit"}
            </span>
            <span
              className={cn(
                "font-mono font-semibold",
                netDebitCredit <= 0 ? "text-bear" : "text-bull"
              )}
            >
              ${Math.abs(netDebitCredit).toFixed(2)}
            </span>
          </div>
        </div>

        {/* ── P/L at expiry — wealth curve table ──────────────────────────── */}
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            P/L at Expiry
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="pb-0.5 text-left text-[10px] font-normal text-slate-600">Move</th>
                <th className="pb-0.5 text-right text-[10px] font-normal text-slate-600">
                  {selectedSymbol} price
                </th>
                <th className="pb-0.5 text-right text-[10px] font-normal text-slate-600">P/L</th>
              </tr>
            </thead>
            <tbody>
              {wealthRows.map(({ pct, price, pnl }) => {
                const isNow   = pct === 0;
                const pnlColor =
                  pnl > 0 ? "text-bull" : pnl < 0 ? "text-bear" : "text-slate-400";
                return (
                  <tr
                    key={pct}
                    className={cn(
                      "border-b border-surface-800/40",
                      isNow && "bg-surface-800/70"
                    )}
                  >
                    <td
                      className={cn(
                        "py-[3px] font-mono text-[11px]",
                        isNow
                          ? "font-bold text-slate-200"
                          : pct < 0 ? "text-bear/70" : "text-bull/70"
                      )}
                    >
                      {pct > 0 ? "+" : ""}{pct}%
                    </td>
                    <td
                      className={cn(
                        "py-[3px] text-right font-mono text-[11px]",
                        isNow ? "font-semibold text-slate-200" : "text-slate-500"
                      )}
                    >
                      ${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </td>
                    <td
                      className={cn(
                        "py-[3px] text-right font-mono text-[11px] font-semibold",
                        pnlColor
                      )}
                    >
                      {fmtPnl(pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Summary metrics ──────────────────────────────────────────────── */}
        <div className="mb-3 space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Max gain</span>
            <span className="font-mono text-bull">{maxGainStr}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Max loss</span>
            <span className="font-mono text-bear">{maxLossStr}</span>
          </div>
          {breakevens.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">
                Breakeven{breakevens.length > 1 ? "s" : ""}
              </span>
              <span className="font-mono text-slate-300">
                {breakevens.map((b) => formatPrice(b)).join(" / ")}
              </span>
            </div>
          )}
        </div>

        {/* ── PoP + EV from simulation ─────────────────────────────────────── */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded border border-surface-700/50 bg-surface-800/40 px-2 py-1.5">
          <div>
            <span className="text-[10px] text-slate-500">PoP</span>
            <p
              className={cn(
                "font-mono text-xs font-medium",
                !simulation
                  ? "text-slate-500"
                  : simulation.pop >= 0.55 ? "text-bull"
                  : simulation.pop <= 0.35 ? "text-bear"
                  : "text-amber-400"
              )}
            >
              {simulation ? popStr : "simulating…"}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500">EV</span>
            <p
              className={cn(
                "font-mono text-xs font-medium",
                !simulation
                  ? "text-slate-500"
                  : simulation.ev >= 0 ? "text-bull" : "text-bear"
              )}
            >
              {simulation ? `${simulation.ev >= 0 ? "+" : "−"}$${Math.abs(simulation.ev).toFixed(0)}` : "—"}
            </p>
          </div>
        </div>

        {/* ── Expand / collapse: payoff chart + rationale + risks ───────────── */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between text-[10px] text-slate-500 hover:text-slate-400"
        >
          <span>View payoff chart &amp; rationale</span>
          {expanded
            ? <ChevronUp   className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />
          }
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            {/* Payoff chart */}
            <div className="overflow-hidden rounded-lg bg-surface-800/50">
              <PayoffChart legs={strategy.legs} spot={spot} height={90} />
            </div>

            {/* Rationale bullets */}
            <ul className="space-y-1">
              {rationale.map((bullet, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] text-slate-400">
                  <span className="mt-0.5 shrink-0 text-brand-500">•</span>
                  {bullet}
                </li>
              ))}
            </ul>

            {/* Risks */}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
