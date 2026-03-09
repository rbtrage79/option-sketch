"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PenLine, MessageSquare, TrendingUp, Wifi, WifiOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { POPULAR_SYMBOLS } from "@/lib/types";
import { generateMockBars } from "@/lib/mockData";
import { formatPercent, formatPrice } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Live quote hook — tries multiple Yahoo Finance endpoints + CORS proxies,
// shows mock data instantly and replaces with live data when it arrives.
// ---------------------------------------------------------------------------

interface Quote {
  close: number;
  changePct: number;
  live: boolean;
}

function getMockQuote(symbol: string): Quote {
  const bars = generateMockBars(symbol, 2);
  const prev = bars[bars.length - 2];
  const curr = bars[bars.length - 1];
  const changePct = prev ? ((curr.close - prev.close) / prev.close) * 100 : 0;
  return { close: curr.close, changePct, live: false };
}

/** Build a list of URLs to try in order for a 2-day chart */
function chartUrls(symbol: string): string[] {
  const base = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d&includePrePost=false`;
  const base2 = base.replace("query1.", "query2.");
  return [
    base,
    base2,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`,
    `https://corsproxy.io/?${encodeURIComponent(base)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(base2)}`,
  ];
}

function useQuote(symbol: string): Quote {
  const [quote, setQuote] = useState<Quote>(() => getMockQuote(symbol));

  useEffect(() => {
    let cancelled = false;

    async function tryFetch() {
      for (const url of chartUrls(symbol)) {
        try {
          const res = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) continue;
          const json = await res.json();
          const result = json?.chart?.result?.[0];
          const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
          const validCloses = closes.filter((c): c is number => c != null);
          if (validCloses.length >= 2) {
            const prev = validCloses[validCloses.length - 2];
            const curr = validCloses[validCloses.length - 1];
            if (!cancelled) {
              setQuote({ close: curr, changePct: ((curr - prev) / prev) * 100, live: true });
            }
            return; // success — stop trying
          }
        } catch {
          // try next
        }
      }
    }

    // Reset to mock while new symbol loads
    setQuote(getMockQuote(symbol));
    tryFetch();
    return () => { cancelled = true; };
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  return quote;
}

// ---------------------------------------------------------------------------
// Symbol card (compact)
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
      className={`relative flex w-32 flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all ${
        selected
          ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500"
          : "border-surface-700 bg-surface-900 hover:border-surface-600 hover:bg-surface-800"
      }`}
    >
      <span
        className="absolute right-2 top-2"
        title={live ? "Live · Yahoo Finance" : "Simulated (YF unavailable)"}
      >
        {live ? (
          <Wifi className="h-2.5 w-2.5 text-bull/60" />
        ) : (
          <WifiOff className="h-2.5 w-2.5 text-slate-700" />
        )}
      </span>
      <span className="text-sm font-bold text-white">{symbol}</span>
      <span className="font-mono text-xs text-slate-300">{formatPrice(close)}</span>
      <span className={`text-[11px] font-medium ${up ? "text-bull" : "text-bear"}`}>
        {formatPercent(changePct)}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Custom ticker input
// ---------------------------------------------------------------------------

function TickerInput({ onSelect }: { onSelect: (sym: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sym = value.trim().toUpperCase();
    if (sym.length >= 1 && sym.length <= 6 && /^[A-Z.^]+$/.test(sym)) {
      onSelect(sym);
      setValue("");
      inputRef.current?.blur();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Any ticker…"
          maxLength={6}
          className="w-36 rounded-lg border border-surface-700 bg-surface-800 py-1.5 pl-8 pr-3 text-sm text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" className="text-xs">
        Go
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const router = useRouter();
  const { selectedSymbol, setSymbol } = useStore();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-10">
      {/* Hero */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="h-8 w-8 text-brand-500" />
          <h1 className="text-4xl font-bold tracking-tight text-white">OptionSketch</h1>
        </div>
        <p className="max-w-lg text-base text-slate-400">
          Sketch your market outlook on a chart — then discover option strategies that match
          your thesis.
        </p>
      </div>

      {/* Symbol picker */}
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium text-slate-400">Pick a symbol to explore</p>

        {/* Popular symbol grid */}
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_SYMBOLS.map((sym) => (
            <SymbolCard
              key={sym}
              symbol={sym}
              selected={selectedSymbol === sym}
              onSelect={() => setSymbol(sym)}
            />
          ))}
        </div>

        {/* Custom ticker input */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <span className="text-xs text-slate-600">or type any ticker:</span>
          <TickerInput onSelect={setSymbol} />
        </div>

        {/* Currently selected (if not in popular list) */}
        {!(POPULAR_SYMBOLS as readonly string[]).includes(selectedSymbol) && (
          <p className="text-xs text-brand-400">
            Selected: <span className="font-bold">{selectedSymbol}</span>
          </p>
        )}
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
        Live prices via Yahoo Finance · Small wifi icon = live, crossed = simulated
      </p>
    </div>
  );
}
