"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { STRATEGY_DEFS } from "@/lib/strategies";
import type { OptionChain, Strategy } from "@/lib/types";

const BIAS_COLORS: Record<string, string> = {
  bullish: "text-bull",
  bearish: "text-bear",
  neutral: "text-slate-400",
  volatile: "text-amber-400",
};

interface Props {
  chain: OptionChain;
  selectedStrategyId: string;
  selectedExpiry: string;
  onStrategyChange: (strategyId: string) => void;
  onExpiryChange: (expiry: string) => void;
  /** Currently built strategy (for legs preview). */
  strategy: Strategy | null;
}

export default function StrategySelector({
  chain,
  selectedStrategyId,
  selectedExpiry,
  onStrategyChange,
  onExpiryChange,
  strategy,
}: Props) {
  const def = STRATEGY_DEFS.find((d) => d.id === selectedStrategyId);

  return (
    <div className="space-y-3">
      {/* Strategy type dropdown */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            value={selectedStrategyId}
            onChange={(e) => onStrategyChange(e.target.value)}
            className="w-full appearance-none rounded-md border border-surface-700 bg-surface-800 py-1.5 pl-3 pr-7 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {STRATEGY_DEFS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Expiry dropdown */}
        <div className="relative">
          <select
            value={selectedExpiry}
            onChange={(e) => onExpiryChange(e.target.value)}
            className="appearance-none rounded-md border border-surface-700 bg-surface-800 py-1.5 pl-2 pr-6 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {chain.expirations.map((exp) => {
              const daysOut = Math.round(
                (new Date(exp).getTime() - Date.now()) / 86_400_000
              );
              return (
                <option key={exp} value={exp}>
                  {exp} ({daysOut}d)
                </option>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Bias + description */}
      {def && (
        <p className="text-xs text-slate-500">
          <span className={cn("font-medium capitalize", BIAS_COLORS[def.bias])}>
            {def.bias}
          </span>
          {" — "}
          {def.description}
        </p>
      )}

      {/* Legs summary */}
      {strategy && strategy.legs.length > 0 && (
        <div className="rounded-md border border-surface-700 bg-surface-950 p-2 text-xs">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-slate-500">
            Legs
          </div>
          {strategy.legs.map((leg, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-between py-0.5",
                leg.side === "long" ? "text-bull" : "text-bear"
              )}
            >
              <span>
                {leg.side === "long" ? "+" : "−"} 1{" "}
                {leg.expiry.slice(5)} {leg.strike}{" "}
                {leg.type.toUpperCase()}
              </span>
              <span className="font-mono text-slate-300">
                {formatPrice(leg.premium)}
              </span>
            </div>
          ))}
          <div className="mt-1.5 flex justify-between border-t border-surface-700 pt-1">
            <span className="text-slate-500">Net debit/credit</span>
            <span className={cn("font-mono", (() => {
              const net = strategy.legs.reduce(
                (sum, l) => sum + (l.side === "long" ? -l.premium : l.premium),
                0
              ) * 100;
              return net <= 0 ? "text-bear" : "text-bull";
            })())}>
              {formatPrice(
                strategy.legs.reduce(
                  (sum, l) =>
                    sum + (l.side === "long" ? -l.premium : l.premium),
                  0
                ) * 100
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
