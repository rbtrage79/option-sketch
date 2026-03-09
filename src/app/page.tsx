"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, MessageSquare, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { SYMBOLS } from "@/lib/types";
import { generateMockBars } from "@/lib/mockData";
import { formatPercent, formatPrice } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Live quote hook — fetches from Yahoo Finance, falls back to mock
// ---------------------------------------------------------------------------

interface Quote {
  close: number;
  changePct: number;
  live: boolean; // true if from Yahoo Finance
}

function getMockQuote(symbol: string): Quote {
  const bars = generateMockBars(symbol, 2);
  const prev = bars[bars.length - 2];
  const curr = bars[bars.length - 1];
  const changePct = prev ? ((curr.close - prev.close) / prev.close) * 100 : 0;
  return { close: curr.close, changePct, live: false };
}

function useQuote(symbol: string): Quote {
  const [quote, setQuote] = useState<Quote>(() => getMockQuote(symbol));

  useEffect(() => {
    let cancelled = false;

    async function fetch2d() {
      const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
        `?interval=1d&range=2d&includePrePost=false`;

      // Try direct, then CORS proxy
      const proxies = [url, `https://corsproxy.io/?${encodeURIComponent(url)}`];

      for (const endpoint of proxies) {
        try {
          const res = await fetch(endpoint, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) continue;
          const json = await res.json();
          const result = json?.chart?.result?.[0];
          const closes = result?.indicators?.quote?.[0]?.close ?? [];
          if (closes.length >= 2) {
            const prev = closes[closes.length - 2];
            const curr = closes[closes.length - 1];
            if (curr && prev && !cancelled) {
              const changePct = ((curr - prev) / prev) * 100;
              setQuote({ close: curr, changePct, live: true });
            }
          }
          break;
        } catch {
          // Try next endpoint
        }
      }
    }

    fetch2d();
    return () => { cancelled = true; };
  }, [symbol]);

  return quote;
}

// ---------------------------------------------------------------------------
// Symbol card
// ---------------------------------------------------------------------------

function SymbolCard({
  symbol,
  selected,
  onSelect,
}: {
  symbol: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { close, changePct, live } = useQuote(symbol);
  const up = changePct >= 0;

  return (
    <button
      onClick={onSelect}
      className={`relative flex w-44 flex-col items-start rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500"
          : "border-surface-700 bg-surface-900 hover:border-surface-600 hover:bg-surface-800"
      }`}
    >
      {/* Live indicator */}
      <span
        className="absolute right-2.5 top-2.5"
        title={live ? "Live data from Yahoo Finance" : "Using simulated data"}
      >
        {live ? (
          <Wifi className="h-3 w-3 text-bull/60" />
        ) : (
          <WifiOff className="h-3 w-3 text-slate-700" />
        )}
      </span>

      <span className="text-lg font-bold text-white">{symbol}</span>
      <span className="font-mono text-sm text-slate-300">{formatPrice(close)}</span>
      <span className={`text-xs font-medium ${up ? "text-bull" : "text-bear"}`}>
        {formatPercent(changePct)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();
  const { selectedSymbol, setSymbol } = useStore();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 px-6 py-12">
      {/* Hero */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-brand-500" />
          <h1 className="text-4xl font-bold tracking-tight text-white">
            OptionSketch
          </h1>
        </div>
        <p className="max-w-lg text-base text-slate-400">
          Sketch your market outlook directly on a chart — then discover option
          strategies that match your thesis. No finance jargon required.
        </p>
      </div>

      {/* Symbol picker */}
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium text-slate-400">
          Pick a symbol to explore
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {SYMBOLS.map((sym) => (
            <SymbolCard
              key={sym}
              symbol={sym}
              selected={selectedSymbol === sym}
              onSelect={() => setSymbol(sym)}
            />
          ))}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button
          size="lg"
          className="w-56 gap-2"
          onClick={() => router.push("/builder?mode=draw")}
        >
          <PenLine className="h-5 w-5" />
          Start with drawing
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-56 gap-2"
          onClick={() => router.push("/builder?mode=chat")}
        >
          <MessageSquare className="h-5 w-5" />
          Start with chat
        </Button>
      </div>

      <p className="text-xs text-slate-600">
        Prices from Yahoo Finance when available. For educational purposes only.
      </p>
    </div>
  );
}
