"use client";

// ---------------------------------------------------------------------------
// GuidedQA — 5-step wizard to capture scenario + constraints
// Steps: 1) Direction  2) Magnitude  3) Timeframe  4) Vol view  5) Budget
// ---------------------------------------------------------------------------

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { generateMockBars } from "@/lib/mockData";
import type { QAAnswers, CandidateBias } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GuidedQAProps {
  open: boolean;
  onClose: () => void;
  onComplete: (answers: QAAnswers) => void;
}

// ---------------------------------------------------------------------------
// Step option shapes
// ---------------------------------------------------------------------------

interface Option<T> {
  value: T;
  label: string;
  sublabel?: string;
  emoji?: string;
}

const DIRECTION_OPTIONS: Option<CandidateBias>[] = [
  { value: "up",       label: "Up",          sublabel: "Bullish — expecting a price increase",   emoji: "↑" },
  { value: "down",     label: "Down",         sublabel: "Bearish — expecting a price decline",    emoji: "↓" },
  { value: "neutral",  label: "Flat",         sublabel: "Neutral — expecting sideways movement",  emoji: "→" },
  { value: "volatile", label: "Big Move",     sublabel: "Volatile — large move, direction unclear", emoji: "⚡" },
];

const MAGNITUDE_OPTIONS: Option<number>[] = [
  { value: 2,  label: "Tiny",     sublabel: "~2%",  emoji: "·" },
  { value: 4,  label: "Modest",   sublabel: "~4%",  emoji: "▸" },
  { value: 7,  label: "Big",      sublabel: "~7%",  emoji: "▶" },
  { value: 12, label: "Huge",     sublabel: "~12%", emoji: "▶▶" },
];

const TIMEFRAME_OPTIONS: Option<number>[] = [
  { value: 1,  label: "1 week",   sublabel: "~7 days" },
  { value: 2,  label: "2 weeks",  sublabel: "~14 days" },
  { value: 4,  label: "1 month",  sublabel: "~30 days" },
  { value: 8,  label: "2 months", sublabel: "~60 days" },
];

const VOL_OPTIONS: Option<"low" | "normal" | "high">[] = [
  { value: "low",    label: "Cheap IV",  sublabel: "Buy options — premiums feel inexpensive" },
  { value: "normal", label: "Normal IV", sublabel: "Neutral on implied volatility level"     },
  { value: "high",   label: "Expensive IV", sublabel: "Sell/spread — premiums feel pricey"  },
];

const BUDGET_OPTIONS: Option<number | null>[] = [
  { value: 200,  label: "Small",   sublabel: "Up to $200 / contract" },
  { value: 500,  label: "Medium",  sublabel: "Up to $500 / contract" },
  { value: 1000, label: "Large",   sublabel: "Up to $1,000 / contract" },
  { value: null, label: "No limit", sublabel: "No budget constraint"  },
];

// ---------------------------------------------------------------------------
// Generic option picker
// ---------------------------------------------------------------------------

function OptionPicker<T>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
            value === opt.value
              ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500"
              : "border-surface-700 bg-surface-800 hover:border-surface-600 hover:bg-surface-700"
          )}
        >
          {opt.emoji && (
            <span className="mb-1 text-xl leading-none">{opt.emoji}</span>
          )}
          <span className="text-sm font-semibold text-white">{opt.label}</span>
          {opt.sublabel && (
            <span className="mt-0.5 text-[10px] text-slate-500">{opt.sublabel}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_TITLES = [
  "What direction do you expect?",
  "How large a move?",
  "What is your timeframe?",
  "What's your view on implied volatility?",
  "Maximum budget per contract?",
];

const STEP_DESCRIPTIONS = [
  "Pick the direction you expect the stock to move.",
  "How big a price change are you anticipating?",
  "When do you expect this move to happen?",
  "Cheap IV → buy options. Expensive IV → sell premium or use spreads.",
  "Setting a budget helps filter to affordable strategies.",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GuidedQA({ open, onClose, onComplete }: GuidedQAProps) {
  const { selectedSymbol, updateScenario, setConstraints, bars: storeBars, marketStatus } = useStore();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QAAnswers>({});

  const totalSteps = STEP_TITLES.length;

  function set<K extends keyof QAAnswers>(key: K, value: QAAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  function handleNext() {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }

  function handleFinish() {
    // Apply scenario updates
    let spot: number;
    if (marketStatus === "ready" && storeBars.length > 0) {
      spot = storeBars[storeBars.length - 1].close;
    } else {
      const bars = generateMockBars(selectedSymbol, 1);
      spot = bars[bars.length - 1].close;
    }

    const updates: Record<string, unknown> = {};

    if (answers.weeksOut) {
      const d = new Date();
      d.setDate(d.getDate() + answers.weeksOut * 7);
      updates.targetDate = d.toISOString().slice(0, 10);
    }

    if (answers.direction && answers.magnitudePct != null) {
      const factor =
        answers.direction === "up"
          ? 1 + answers.magnitudePct / 100
          : answers.direction === "down"
          ? 1 - answers.magnitudePct / 100
          : 1;
      updates.targetPrice = +(spot * factor).toFixed(2);
      updates.kind = "pointTarget";
    }

    if (Object.keys(updates).length > 0) {
      updateScenario(updates as Parameters<typeof updateScenario>[0]);
    }

    // Apply constraints
    setConstraints({
      volatilityView: answers.volatilityView,
      maxDebitDollars: answers.maxBudgetDollars ?? undefined,
    });

    onComplete(answers);
    onClose();

    // Reset for next time
    setStep(0);
    setAnswers({});
  }

  function handleClose() {
    onClose();
    setStep(0);
    setAnswers({});
  }

  const canAdvance = (() => {
    if (step === 0) return answers.direction !== undefined;
    if (step === 1) return answers.magnitudePct !== undefined;
    if (step === 2) return answers.weeksOut !== undefined;
    return true; // steps 3 & 4 are optional
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>

        {/* Step progress */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-brand-500" : "bg-surface-700"
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="mt-1">
          {step === 0 && (
            <OptionPicker
              options={DIRECTION_OPTIONS}
              value={answers.direction}
              onChange={(v) => set("direction", v)}
            />
          )}
          {step === 1 && (
            <OptionPicker
              options={MAGNITUDE_OPTIONS}
              value={answers.magnitudePct}
              onChange={(v) => set("magnitudePct", v)}
            />
          )}
          {step === 2 && (
            <OptionPicker
              options={TIMEFRAME_OPTIONS}
              value={answers.weeksOut}
              onChange={(v) => set("weeksOut", v)}
            />
          )}
          {step === 3 && (
            <OptionPicker
              options={VOL_OPTIONS}
              value={answers.volatilityView}
              onChange={(v) => set("volatilityView", v)}
            />
          )}
          {step === 4 && (
            <OptionPicker
              options={BUDGET_OPTIONS}
              value={answers.maxBudgetDollars === undefined ? undefined : answers.maxBudgetDollars}
              onChange={(v) => set("maxBudgetDollars", v === null ? undefined : v)}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="mt-2 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0}
            className="text-slate-400"
          >
            Back
          </Button>

          <span className="text-xs text-slate-600">
            {step + 1} / {totalSteps}
          </span>

          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canAdvance}
          >
            {step === totalSteps - 1 ? "Generate strategies" : "Next"}
          </Button>
        </div>

        {step >= 3 && (
          <button
            onClick={handleFinish}
            className="mt-1 w-full text-center text-[10px] text-slate-600 hover:text-slate-400 hover:underline underline-offset-2"
          >
            Skip remaining steps
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
