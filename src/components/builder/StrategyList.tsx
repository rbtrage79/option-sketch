"use client";

// ---------------------------------------------------------------------------
// StrategyList — shows all recommended candidates with compare functionality
// ---------------------------------------------------------------------------

import React, { useState } from "react";
import { Wand2, Loader2, BarChart2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import StrategyCard from "@/components/builder/StrategyCard";
import CompareModal from "@/components/builder/CompareModal";
import { useStore } from "@/lib/store";
import { generateMockBars } from "@/lib/mockData";

interface StrategyListProps {
  onGenerate: () => void;
  isGenerating: boolean;
  progress: number;
  generateError: string | null;
}

export default function StrategyList({
  onGenerate,
  isGenerating,
  progress,
  generateError,
}: StrategyListProps) {
  const { candidates, scenario, selectedSymbol } = useStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const bars = generateMockBars(selectedSymbol, 1);
  const spot = bars[bars.length - 1].close;

  function toggleCompare(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  }

  const compareCount = selectedIds.length;

  // ── Empty / pre-generate state ────────────────────────────────────────────
  if (candidates.length === 0 && !isGenerating) {
    const hasScenario =
      scenario.targetDate || scenario.targetPrice || scenario.pathPoints?.length;

    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="rounded-full border border-surface-700 bg-surface-800 p-3">
          <Wand2 className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-300">
            {hasScenario ? "Ready to generate" : "Draw or describe your scenario first"}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {hasScenario
              ? "Click generate to see ranked strategy candidates."
              : "Use the chart drawing tools or the Chat tab to describe your outlook."}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!hasScenario}
          onClick={onGenerate}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Generate candidates
        </Button>

        <div className="flex items-start gap-1.5 rounded-xl border border-surface-700 bg-surface-900 p-3 text-left text-[11px] text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500/60" />
          <span>
            Strategies are scored based on your outlook, not labelled &ldquo;best.&rdquo; Always review
            risk/reward before trading.
          </span>
        </div>
      </div>
    );
  }

  // ── Generating state ──────────────────────────────────────────────────────
  if (isGenerating && candidates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <p className="text-xs text-slate-500">Analysing strategies…</p>
      </div>
    );
  }

  // ── Candidates list ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">
          {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          {isGenerating && (
            <span className="ml-1.5 text-[10px] text-slate-600">
              · simulating…
            </span>
          )}
        </p>

        <div className="flex items-center gap-2">
          {compareCount >= 2 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={() => setCompareOpen(true)}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Compare ({compareCount})
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-slate-500"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Simulation progress bar */}
      {isGenerating && (
        <div className="h-1 overflow-hidden rounded-full bg-surface-700">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error banner */}
      {generateError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {generateError}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-1.5 rounded-xl border border-surface-700 bg-surface-900 p-2 text-left text-[10px] text-slate-600">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Candidates are sorted by fit score. None is labelled &ldquo;best.&rdquo; These are not
          investment recommendations.
        </span>
      </div>

      {/* Strategy cards */}
      {candidates.map((candidate) => (
        <StrategyCard
          key={candidate.id}
          candidate={candidate}
          spot={spot}
          isSelected={selectedIds.includes(candidate.id)}
          onToggleCompare={toggleCompare}
          compareDisabled={compareCount >= 3 && !selectedIds.includes(candidate.id)}
        />
      ))}

      {compareCount > 0 && compareCount < 2 && (
        <p className="text-center text-[10px] text-slate-600">
          Select {2 - compareCount} more to enable comparison
        </p>
      )}

      {/* Compare modal */}
      <CompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        candidates={candidates.filter((c) => selectedIds.includes(c.id))}
        spot={spot}
      />
    </div>
  );
}
