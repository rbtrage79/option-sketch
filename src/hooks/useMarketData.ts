"use client";

// ---------------------------------------------------------------------------
// useMarketData — fetches live bars + options chain for the selected symbol
//
// On mount and every time selectedSymbol changes:
//   1. Try Yahoo Finance (direct → CORS proxy fallback)
//   2. On any failure, fall back to local mock generators
//   3. Write result into the Zustand store
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { fetchBars, fetchOptionChain } from "@/lib/yahooFinance";
import { generateMockBars } from "@/lib/mockData";
import { generateOptionChain } from "@/lib/optionChain";

export function useMarketData() {
  const { selectedSymbol, setMarketData, setMarketStatus } = useStore();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request for the previous symbol
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setMarketStatus("loading");

    let cancelled = false;

    async function load() {
      try {
        // Parallel fetch: bars + option chain
        const [bars, chain] = await Promise.all([
          fetchBars(selectedSymbol),
          fetchOptionChain(selectedSymbol),
        ]);

        if (cancelled) return;
        setMarketData(bars, chain);
      } catch {
        if (cancelled) return;

        // Silent fallback to mock data
        console.warn(
          `[useMarketData] Yahoo Finance unavailable for ${selectedSymbol} — using mock data`
        );
        try {
          const bars = generateMockBars(selectedSymbol);
          const chain = generateOptionChain(selectedSymbol);
          if (!cancelled) setMarketData(bars, chain);
        } catch (mockErr) {
          if (!cancelled) {
            setMarketStatus(
              "error",
              mockErr instanceof Error ? mockErr.message : "Failed to load market data"
            );
          }
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol]);
}
