"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Play,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StrategySelector from "@/components/builder/StrategySelector";
import { useStore } from "@/lib/store";
import { useMonteCarlo } from "@/hooks/useMonteCarlo";
import { generateMockBars } from "@/lib/mockData";
import { generateOptionChain } from "@/lib/optionChain";
import { DEFAULT_STRATEGY_ID, buildStrategy, getStrategyById, pickExpiry } from "@/lib/strategies";
import { formatPrice, cn } from "@/lib/utils";
import type { SimMode } from "@/lib/types";

// Lazy-load distribution chart (ECharts)
const DistributionChart = dynamic(
  () => import("@/components/chart/DistributionChart"),
  { ssr: false }
);

// Re-export pickExpiry here since it's used internally
// (it lives in optionChain.ts but let's import from there)

// ---------------------------------------------------------------------------
// Helper: map uncertaintyLevel → annualised vol
// uncertaintyLevel=0 → 20%, uncertaintyLevel=100 → 60%
// ---------------------------------------------------------------------------
function uncertaintyToVol(level: number): number {
  return 0.20 + (level / 100) * 0.40;
}

// ---------------------------------------------------------------------------
// Stat display cell
// ---------------------------------------------------------------------------
function StatCell({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" title={tooltip}>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className={cn("font-mono text-sm font-semibold", color ?? "text-white")}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Percentile table row
// ---------------------------------------------------------------------------
function PctRow({ label, value }: { label: string; value: number }) {
  const color = value >= 0 ? "text-bull" : "text-bear";
  return (
    <tr className="border-b border-surface-800">
      <td className="py-1 text-xs text-slate-500">{label}</td>
      <td className={cn("py-1 text-right font-mono text-xs", color)}>
        {value >= 0 ? "+" : ""}
        {formatPrice(value)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  /** Called when "Generate candidate strategies" is clicked (still disabled, shows toast). */
  onGenerate: () => void;
}

export default function SimulationPanel({ onGenerate }: Props) {
  const {
    scenario,
    selectedSymbol,
    bars: storeBars,
    chain: storeChain,
    marketStatus,
  } = useStore();
  const { simulate, reset, result, isRunning, error } = useMonteCarlo();

  const [simMode, setSimMode] = useState<SimMode>("simple");
  const [selectedStrategyId, setSelectedStrategyId] = useState(DEFAULT_STRATEGY_ID);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [hasRun, setHasRun] = useState(false);

  // ---------------------------------------------------------------------------
  // Build chain & pick auto-expiry
  // ---------------------------------------------------------------------------
  const chain = useMemo(
    () => (marketStatus === "ready" && storeChain ? storeChain : generateOptionChain(selectedSymbol)),
    [selectedSymbol, storeChain, marketStatus]
  );

  // Initialise expiry to the one closest to targetDate (or ~28d out)
  useEffect(() => {
    if (!chain.expirations.length) return;
    const targetDaysOut = scenario.targetDate
      ? Math.round(
          (new Date(scenario.targetDate).getTime() - Date.now()) / 86_400_000
        )
      : 28;
    const best = pickExpiry(chain.expirations, Math.max(7, targetDaysOut));
    setSelectedExpiry(best);
  }, [chain.expirations, scenario.targetDate]);

  // ---------------------------------------------------------------------------
  // Derived scenario state
  // ---------------------------------------------------------------------------
  const spot = useMemo(() => {
    if (marketStatus === "ready" && storeBars.length > 0) {
      return storeBars[storeBars.length - 1].close;
    }
    const bars = generateMockBars(selectedSymbol, 1);
    return bars[bars.length - 1]?.close ?? 100;
  }, [selectedSymbol, storeBars, marketStatus]);

  const vol = uncertaintyToVol(scenario.uncertaintyLevel ?? 20);

  const T = useMemo(() => {
    if (!scenario.targetDate) return 0;
    const diff = new Date(scenario.targetDate).getTime() - Date.now();
    return Math.max(0, diff / (365.25 * 86_400_000));
  }, [scenario.targetDate]);

  const isScenarioReady = useMemo(
    () => T > 0 && !!scenario.targetDate,
    [T, scenario.targetDate]
  );

  // ---------------------------------------------------------------------------
  // Build current strategy
  // ---------------------------------------------------------------------------
  const strategy = useMemo(() => {
    if (!selectedExpiry) return null;
    return buildStrategy(selectedStrategyId, chain, selectedExpiry);
  }, [selectedStrategyId, chain, selectedExpiry]);

  const strategyDef = getStrategyById(selectedStrategyId);

  // ---------------------------------------------------------------------------
  // Run simulation
  // ---------------------------------------------------------------------------
  const runSim = useCallback(() => {
    if (!isScenarioReady || !strategy) return;
    simulate({
      spot,
      r: 0.02,
      vol,
      T,
      legs: strategy.legs,
      numPaths: 20_000,
    });
    setHasRun(true);
  }, [isScenarioReady, strategy, simulate, spot, vol, T]);

  // Auto-run when scenario or strategy changes (debounced 600ms)
  useEffect(() => {
    if (!isScenarioReady || !strategy) return;
    const timer = setTimeout(runSim, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.targetDate, scenario.uncertaintyLevel, selectedStrategyId, selectedExpiry, selectedSymbol]);

  // ---------------------------------------------------------------------------
  // Greeks from strategy legs (from mock chain data)
  // ---------------------------------------------------------------------------
  const greeksSummary = useMemo(() => {
    if (!strategy) return null;
    let delta = 0, theta = 0, vega = 0;
    for (const leg of strategy.legs) {
      const contracts = chain.chains[leg.expiry] ?? [];
      const match = contracts.find(
        (c) => c.type === leg.type && c.strike === leg.strike
      );
      if (!match) continue;
      const dir = leg.side === "long" ? 1 : -1;
      delta += dir * match.delta * leg.qty * 100;
      theta += dir * match.theta * leg.qty * 100;
      vega += dir * match.vega * leg.qty * 100;
    }
    return {
      delta: +delta.toFixed(2),
      theta: +theta.toFixed(2),
      vega: +vega.toFixed(2),
    };
  }, [strategy, chain]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function fmtPnl(v: number | null): string {
    if (v === null) return "Unlimited";
    return `${v >= 0 ? "+" : ""}${formatPrice(v)}`;
  }

  function popColor(pop: number): string {
    if (pop >= 0.55) return "text-bull";
    if (pop <= 0.35) return "text-bear";
    return "text-amber-400";
  }

  function evColor(ev: number): string {
    return ev >= 0 ? "text-bull" : "text-bear";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-brand-500" />
            Simulation
          </CardTitle>
          {/* Simple / Advanced toggle */}
          <div className="flex rounded-md border border-surface-700 text-xs">
            {(["simple", "advanced"] as SimMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setSimMode(m)}
                className={cn(
                  "px-2.5 py-1 capitalize transition-colors",
                  simMode === m
                    ? "bg-surface-700 text-white"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* ── Strategy selector ──────────────────────────────────────────── */}
        <StrategySelector
          chain={chain}
          selectedStrategyId={selectedStrategyId}
          selectedExpiry={selectedExpiry}
          onStrategyChange={(id) => {
            setSelectedStrategyId(id);
            reset();
          }}
          onExpiryChange={(exp) => {
            setSelectedExpiry(exp);
            reset();
          }}
          strategy={strategy}
        />

        {/* ── Simulate button ─────────────────────────────────────────────── */}
        <Button
          onClick={runSim}
          disabled={!isScenarioReady || !strategy || isRunning}
          className="w-full gap-2"
          variant={hasRun ? "secondary" : "default"}
          title={!isScenarioReady ? "Draw a scenario first" : undefined}
        >
          {isRunning ? (
            <>
              <RotateCcw className="h-4 w-4 animate-spin" />
              Running 20 000 paths…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {hasRun ? "Re-simulate" : "Simulate scenario"}
            </>
          )}
        </Button>

        {/* Indeterminate progress bar while running */}
        {isRunning && (
          <div className="h-0.5 overflow-hidden rounded-full bg-surface-700">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-brand-500" />
          </div>
        )}

        {!isScenarioReady && (
          <p className="text-center text-xs text-slate-600">
            Draw a target on the chart to enable simulation.
          </p>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-950/40 p-2 text-xs text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────────── */}
        {result && !isRunning && (
          <>
            <div className="border-t border-surface-700" />

            {/* Risk label */}
            {strategyDef && (
              <div className="flex items-start gap-1.5 text-xs text-amber-400/80">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {strategyDef.riskLabel}
              </div>
            )}

            {/* ── Simple stats grid ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <StatCell
                label="P(Profit)"
                value={`${(result.pop * 100).toFixed(1)}%`}
                color={popColor(result.pop)}
                tooltip="Fraction of simulated paths with P/L > 0"
              />
              <StatCell
                label="Expected Value"
                value={fmtPnl(result.ev)}
                color={evColor(result.ev)}
                tooltip="Average P/L across all paths"
              />
              <StatCell
                label="Max Loss"
                value={fmtPnl(result.maxLoss)}
                color="text-bear"
              />
              <StatCell
                label="Max Gain"
                value={fmtPnl(result.maxGain)}
                color="text-bull"
              />
            </div>

            {/* Breakevens */}
            {result.breakevens.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  Breakeven{result.breakevens.length > 1 ? "s" : ""}
                </span>
                <div className="flex flex-wrap gap-1">
                  {result.breakevens.map((be) => (
                    <span
                      key={be}
                      className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-xs text-amber-300"
                    >
                      {formatPrice(be)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Computation time */}
            <p className="text-right text-[10px] text-slate-700">
              20 000 paths · {result.durationMs}ms
            </p>

            {/* ── Advanced mode extras ──────────────────────────────────── */}
            {simMode === "advanced" && (
              <>
                <div className="border-t border-surface-700" />

                {/* Distribution chart */}
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                    <BarChart3 className="h-3 w-3" />
                    P/L distribution
                  </div>
                  <DistributionChart
                    histogram={result.histogram}
                    ev={result.ev}
                    breakevens={result.breakevens}
                    height={160}
                  />
                </div>

                {/* Percentile table */}
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                    Percentile table
                  </div>
                  <table className="w-full">
                    <tbody>
                      <PctRow label="p5  (worst 5%)" value={result.percentiles.p5} />
                      <PctRow label="p25" value={result.percentiles.p25} />
                      <PctRow label="p50 (median)" value={result.percentiles.p50} />
                      <PctRow label="p75" value={result.percentiles.p75} />
                      <PctRow label="p95 (best 5%)" value={result.percentiles.p95} />
                    </tbody>
                  </table>
                </div>

                {/* Greeks summary */}
                {greeksSummary && (
                  <div>
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-slate-500">
                      Position Greeks (approx.)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <StatCell
                        label="Delta Δ"
                        value={greeksSummary.delta.toFixed(2)}
                        tooltip="P/L per $1 move in underlying"
                      />
                      <StatCell
                        label="Theta Θ/day"
                        value={formatPrice(greeksSummary.theta)}
                        color={greeksSummary.theta < 0 ? "text-bear" : "text-bull"}
                        tooltip="P/L per calendar day of time passage"
                      />
                      <StatCell
                        label="Vega V/1%"
                        value={formatPrice(greeksSummary.vega)}
                        color={greeksSummary.vega >= 0 ? "text-bull" : "text-bear"}
                        tooltip="P/L per +1% move in implied volatility"
                      />
                    </div>
                    {/* TODO (Step 3): Add live Greeks from real-time IV feed */}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
