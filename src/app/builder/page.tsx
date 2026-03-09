"use client";

import React, { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ChevronDown, PenLine, MessageSquare, Wand2, Wifi, WifiOff, Loader2 } from "lucide-react";
import DrawingToolbar from "@/components/builder/DrawingToolbar";
import ScenarioSummary from "@/components/builder/ScenarioSummary";
import SimulationPanel from "@/components/builder/SimulationPanel";
import ChatPanel from "@/components/builder/ChatPanel";
import StrategyList from "@/components/builder/StrategyList";
import GuidedQA from "@/components/builder/GuidedQA";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useRecommender } from "@/hooks/useRecommender";
import { useMarketData } from "@/hooks/useMarketData";
import { useStore } from "@/lib/store";
import { SYMBOLS } from "@/lib/types";
import type { DrawingTool, SidebarTab } from "@/lib/types";
import { cn } from "@/lib/utils";

const CandlestickChart = dynamic(
  () => import("@/components/chart/CandlestickChart"),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

function ChartSkeleton() {
  return (
    <div className="flex h-full w-full animate-pulse items-center justify-center rounded-lg bg-surface-900">
      <span className="text-sm text-slate-600">Loading chart…</span>
    </div>
  );
}

// ── Tab bar ─────────────────────────────────────────────────────────────────

const TABS: { id: SidebarTab; label: string; Icon: React.ElementType }[] = [
  { id: "draw",       label: "Draw",       Icon: PenLine      },
  { id: "chat",       label: "Chat",       Icon: MessageSquare },
  { id: "strategies", label: "Strategies", Icon: Wand2         },
];

function TabBar({
  active,
  onChange,
  strategyCount,
}: {
  active: SidebarTab;
  onChange: (t: SidebarTab) => void;
  strategyCount: number;
}) {
  return (
    <div className="flex border-b border-surface-800">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors",
            active === id
              ? "border-b-2 border-brand-500 text-brand-400"
              : "text-slate-500 hover:text-slate-300"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {id === "strategies" && strategyCount > 0 && (
            <span className="rounded-full bg-brand-500/20 px-1.5 py-0.5 text-[10px] text-brand-400">
              {strategyCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Inner component ──────────────────────────────────────────────────────────

function BuilderInner() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") as SidebarTab | null;

  const {
    selectedSymbol, setSymbol, setActiveTool, resetScenario, candidates,
    marketStatus, bars: storeBars,
  } = useStore();
  const { toasts, toast, dismiss } = useToast();

  const [localTool, setLocalTool] = useState<DrawingTool>("none");
  const [activeTab, setActiveTab] = useState<SidebarTab>(
    initialMode === "chat" ? "chat" : "draw"
  );
  const [guidedQAOpen, setGuidedQAOpen] = useState(false);

  const { generate, isGenerating, progress, error: generateError } = useRecommender();

  // Kick off live market data fetch (bars + options chain) for selected symbol
  useMarketData();

  function handleToolChange(tool: DrawingTool) {
    setLocalTool(tool);
    setActiveTool(tool);
  }

  function handleToolDone() {
    handleToolChange("none");
  }

  function handleGenerateStrategies() {
    generate();
    setActiveTab("strategies");
  }

  function handleGuidedQAComplete() {
    generate();
    setActiveTab("strategies");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-surface-800 bg-surface-900 px-4 py-2">
        {/* Symbol selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Symbol</span>
          <div className="relative">
            <select
              value={selectedSymbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                resetScenario();
                handleToolChange("none");
              }}
              className="appearance-none rounded-md border border-surface-700 bg-surface-800 py-1 pl-3 pr-7 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="h-5 w-px bg-surface-700" />

        {/* Drawing tools (always visible) */}
        <DrawingToolbar activeTool={localTool} onToolChange={handleToolChange} />

        <div className="flex-1" />

        {/* Live data status badge */}
        {marketStatus === "loading" && (
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Fetching live data…
          </span>
        )}
        {marketStatus === "ready" && (
          <span
            className="flex items-center gap-1 text-[10px] text-bull/70"
            title={`Live data · ${storeBars.length} bars`}
          >
            <Wifi className="h-3 w-3" />
            Live
          </span>
        )}
        {marketStatus === "error" && (
          <span
            className="flex items-center gap-1 text-[10px] text-slate-600"
            title="Using simulated data"
          >
            <WifiOff className="h-3 w-3" />
            Simulated
          </span>
        )}

        {localTool === "path" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleToolChange("none")}
            className="text-xs"
          >
            Done with path
          </Button>
        )}
      </div>

      {/* ── Main two-column layout ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart area */}
        <div className="relative flex-1 overflow-hidden p-3">
          <CandlestickChart
            symbol={selectedSymbol}
            drawingTool={localTool}
            onToolDone={handleToolDone}
          />
        </div>

        {/* Right sidebar */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-surface-800 xl:w-80">
          {/* Tab bar */}
          <TabBar
            active={activeTab}
            onChange={setActiveTab}
            strategyCount={candidates.length}
          />

          {/* Tab content — each tab owns its own scroll/overflow */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "draw" && (
              <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
                <ScenarioSummary
                  onGenerateStrategies={handleGenerateStrategies}
                  toast={toast}
                />
                <SimulationPanel onGenerate={handleGenerateStrategies} />
              </div>
            )}

            {activeTab === "chat" && (
              <div className="flex h-full flex-col p-3">
                <ChatPanel
                  onGenerate={handleGenerateStrategies}
                  onOpenGuidedQA={() => setGuidedQAOpen(true)}
                />
              </div>
            )}

            {activeTab === "strategies" && (
              <div className="h-full overflow-y-auto p-3">
                <StrategyList
                  onGenerate={handleGenerateStrategies}
                  isGenerating={isGenerating}
                  progress={progress}
                  generateError={generateError}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Guided Q&A dialog */}
      <GuidedQA
        open={guidedQAOpen}
        onClose={() => setGuidedQAOpen(false)}
        onComplete={handleGuidedQAComplete}
      />

      {/* Toast container */}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <BuilderInner />
    </Suspense>
  );
}
