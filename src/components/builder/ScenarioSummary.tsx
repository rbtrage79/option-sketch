"use client";

import React, { useMemo } from "react";
import { AlertCircle, CheckCircle2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { generateMockBars } from "@/lib/mockData";
import { validateScenario } from "@/lib/schema";
import { formatDate, formatPercent, formatPrice } from "@/lib/utils";
import type { Toast } from "@/hooks/use-toast";

interface Props {
  onGenerateStrategies: () => void;
  toast: (opts: Omit<Toast, "id">) => string;
}

export default function ScenarioSummary({ onGenerateStrategies, toast }: Props) {
  const { scenario, updateScenario, selectedSymbol } = useStore();

  // Get current price (last close of mock data)
  const currentPrice = useMemo(() => {
    const bars = generateMockBars(selectedSymbol);
    return bars[bars.length - 1]?.close ?? 0;
  }, [selectedSymbol]);

  // Derive display values
  const targetPrice = useMemo(() => {
    if (scenario.kind === "pointTarget") return scenario.targetPrice;
    if (scenario.kind === "path" && scenario.pathPoints?.length) {
      return scenario.pathPoints[scenario.pathPoints.length - 1].price;
    }
    return undefined;
  }, [scenario]);

  const targetDate = scenario.targetDate;

  const expectedMovePct = useMemo(() => {
    if (!targetPrice || !currentPrice) return null;
    return ((targetPrice - currentPrice) / currentPrice) * 100;
  }, [targetPrice, currentPrice]);

  const daysToTarget = useMemo(() => {
    if (!targetDate) return null;
    const diffMs = new Date(targetDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / 86_400_000));
  }, [targetDate]);

  // Validation
  const validation = useMemo(() => {
    if (!scenario.kind) return null;
    return validateScenario(scenario);
  }, [scenario]);

  const isValid = validation?.success === true;

  function handleGenerate() {
    if (!isValid) {
      toast({
        title: "Incomplete scenario",
        description: validation?.success === false ? validation.error : "Draw a target first.",
        variant: "destructive",
      });
      return;
    }
    // TODO (Step 2): Trigger actual strategy generation
    onGenerateStrategies();
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Scenario Summary</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Symbol */}
        <Row label="Symbol">
          <span className="font-mono text-sm font-bold text-white">
            {selectedSymbol}
          </span>
        </Row>

        {/* Current price */}
        <Row label="Current Price">
          <span className="font-mono text-sm text-slate-300">
            {formatPrice(currentPrice)}
          </span>
        </Row>

        {/* Kind badge */}
        {scenario.kind && (
          <Row label="Scenario type">
            <span className="rounded-full bg-surface-700 px-2 py-0.5 text-xs text-slate-300">
              {scenario.kind === "pointTarget" ? "Point Target" : "Price Path"}
            </span>
          </Row>
        )}

        {/* Target date */}
        <Row label="Target Date">
          {targetDate ? (
            <span className="text-sm text-slate-200">{formatDate(targetDate)}</span>
          ) : (
            <EmptyHint>Draw on chart →</EmptyHint>
          )}
        </Row>

        {/* Days to target */}
        {daysToTarget !== null && (
          <Row label="Days to Target">
            <span className="text-sm text-slate-200">{daysToTarget}d</span>
          </Row>
        )}

        {/* Target price */}
        <Row label="Target Price">
          {targetPrice !== undefined ? (
            <span className="font-mono text-sm font-semibold text-white">
              {formatPrice(targetPrice)}
            </span>
          ) : (
            <EmptyHint>Draw on chart →</EmptyHint>
          )}
        </Row>

        {/* Expected move */}
        <Row label="Expected Move">
          {expectedMovePct !== null ? (
            <span
              className={`flex items-center gap-1 font-mono text-sm font-semibold ${
                expectedMovePct >= 0 ? "text-bull" : "text-bear"
              }`}
            >
              {expectedMovePct >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {formatPercent(expectedMovePct)}
            </span>
          ) : (
            <EmptyHint>—</EmptyHint>
          )}
        </Row>

        {/* Path points count */}
        {scenario.kind === "path" && scenario.pathPoints && (
          <Row label="Path Points">
            <span className="text-sm text-slate-200">
              {scenario.pathPoints.length} waypoints
            </span>
          </Row>
        )}

        {/* Divider */}
        <div className="my-1 border-t border-surface-700" />

        {/* Uncertainty slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Uncertainty</span>
            <span className="text-xs font-mono text-slate-300">
              {scenario.uncertaintyLevel ?? 20}
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[scenario.uncertaintyLevel ?? 20]}
            onValueChange={([val]) =>
              updateScenario({ uncertaintyLevel: val })
            }
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Confident</span>
            <span>Uncertain</span>
          </div>
        </div>

        {/* Divider */}
        <div className="my-1 border-t border-surface-700" />

        {/* Validation status */}
        {scenario.kind && (
          <div className="flex items-start gap-2">
            {isValid ? (
              <>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bull" />
                <span className="text-xs text-slate-400">
                  Scenario looks good. Ready to generate strategies.
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-xs text-amber-400/80">
                  {validation?.success === false ? validation.error : "Incomplete — keep drawing."}
                </span>
              </>
            )}
          </div>
        )}

        {/* CTA button — still disabled; wired in Step 3 */}
        <Button
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={!isValid}
          variant="outline"
          title={!isValid ? "Complete your scenario first" : undefined}
        >
          <Sparkles className="h-4 w-4" />
          Generate candidate strategies
          {/* TODO (Step 3): wire to ranked strategy list from simulation */}
        </Button>

        {!scenario.kind && (
          <p className="text-center text-xs text-slate-500">
            Use the drawing tools on the chart to define your price expectation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Small layout helpers ──────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <span className="text-xs italic text-slate-600">{children}</span>;
}
