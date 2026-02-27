"use client";

// ---------------------------------------------------------------------------
// ChatPanel — natural language scenario input
//
// The user types free text like "up 5% in 2 months" and the panel parses it
// into a Scenario, updates the store, and triggers strategy generation.
// ---------------------------------------------------------------------------

import React, { useState, useRef, useEffect } from "react";
import { Send, Lightbulb, AlertCircle, CheckCircle2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { parseScenario } from "@/lib/scenarioParser";
import { generateMockBars } from "@/lib/mockData";
import type { ChatMessage, ParseResult } from "@/lib/types";

interface ChatPanelProps {
  onGenerate: () => void;
  onOpenGuidedQA: () => void;
}

function msgId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

/** Format a parsed result into a human-readable assistant reply. */
function buildReply(result: ParseResult, symbol: string): string {
  if (result.confidence === "low" || result.parsedFields.length === 0) {
    return `I wasn't sure how to parse that for ${symbol}. ${result.hint ?? "Try something like 'up 5% in 2 months'."}`;
  }

  const parts: string[] = [];
  if (result.direction) {
    const dirLabel =
      result.direction === "up"
        ? "bullish"
        : result.direction === "down"
        ? "bearish"
        : result.direction === "volatile"
        ? "expecting a big move"
        : "neutral";
    parts.push(`Direction: ${dirLabel}`);
  }
  if (result.magnitudePct != null) {
    parts.push(`Move: ~${result.magnitudePct.toFixed(1)}%`);
  }
  if (result.targetDate) {
    const d = new Date(result.targetDate);
    parts.push(`By: ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
  }
  if (result.targetPrice != null) {
    parts.push(`Target price: $${result.targetPrice.toFixed(2)}`);
  }

  const summary = parts.join(" · ");

  if (result.ambiguous) {
    return `I parsed: ${summary}. Some signals were conflicting — you may want to clarify or use Guided Q&A.`;
  }

  if (result.confidence === "medium") {
    return `Got it: ${summary}. ${result.hint ?? "Ready to generate strategy candidates!"}`;
  }

  return `Understood: ${summary}. Ready to generate strategy candidates!`;
}

const EXAMPLE_PROMPTS = [
  "up 5% in 2 months",
  "flat for 4 weeks",
  "big move either way in 3 weeks",
  "down 10% by end of March",
  "bullish, targeting 480 by next month",
];

export default function ChatPanel({ onGenerate, onOpenGuidedQA }: ChatPanelProps) {
  const { selectedSymbol, scenario, chatMessages, addChatMessage, updateScenario } =
    useStore();

  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<ParseResult | null>(null);
  const [readyToGenerate, setReadyToGenerate] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: msgId(),
      role: "user",
      text: trimmed,
      timestamp: now(),
    };
    addChatMessage(userMsg);
    setInput("");
    setReadyToGenerate(false);

    // Parse
    const result = parseScenario(trimmed);
    setLastResult(result);

    // Update scenario if we got useful info
    if (result.parsedFields.length > 0) {
      const updates: Record<string, unknown> = {};

      if (result.targetDate) updates.targetDate = result.targetDate;
      if (result.targetPrice != null) {
        updates.targetPrice = result.targetPrice;
        updates.kind = "pointTarget";
      } else if (result.direction && result.magnitudePct != null) {
        // Derive a targetPrice from direction + magnitude
        const bars = generateMockBars(selectedSymbol, 1);
        const spotNow = bars[bars.length - 1].close;
        const factor =
          result.direction === "up"
            ? 1 + result.magnitudePct / 100
            : result.direction === "down"
            ? 1 - result.magnitudePct / 100
            : 1;
        updates.targetPrice = +(spotNow * factor).toFixed(2);
        updates.kind = "pointTarget";
      }

      if (Object.keys(updates).length > 0) {
        updateScenario(updates as Parameters<typeof updateScenario>[0]);
      }
    }

    const reply = buildReply(result, selectedSymbol);
    const assistantMsg: ChatMessage = {
      id: msgId(),
      role: "assistant",
      text: reply,
      timestamp: now(),
    };
    addChatMessage(assistantMsg);

    if (result.parsedFields.length >= 2 && !result.ambiguous) {
      setReadyToGenerate(true);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Messages ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-2">
        {chatMessages.length === 0 && (
          <div className="py-4 text-center">
            <Lightbulb className="mx-auto mb-2 h-5 w-5 text-brand-500/60" />
            <p className="text-xs text-slate-500">
              Describe your market outlook in plain English
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleSubmit(ex)}
                  className="rounded-lg border border-surface-700 bg-surface-800 px-3 py-1.5 text-left text-xs text-slate-400 transition hover:border-surface-600 hover:text-slate-300"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-surface-800 text-slate-300"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Ready to generate banner */}
        {readyToGenerate && (
          <div className="rounded-xl border border-green-800/40 bg-green-900/20 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Scenario captured
            </div>
            <Button
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => {
                setReadyToGenerate(false);
                onGenerate();
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Generate strategy candidates
            </Button>
          </div>
        )}

        {/* Guided Q&A prompt — shown after low-confidence parse */}
        {lastResult && lastResult.confidence === "low" && (
          <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Not enough info to parse
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={onOpenGuidedQA}
            >
              Try Guided Q&A instead
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="mt-2 flex gap-2 border-t border-surface-800 pt-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. up 5% in 2 months…"
          className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
        />
        <Button
          size="sm"
          className="shrink-0 px-2.5"
          onClick={() => handleSubmit(input)}
          disabled={!input.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Guided Q&A shortcut */}
      <button
        onClick={onOpenGuidedQA}
        className="mt-1.5 text-center text-[10px] text-slate-600 underline-offset-2 hover:text-slate-400 hover:underline"
      >
        Or answer a few quick questions →
      </button>
    </div>
  );
}
