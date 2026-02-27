"use client";

// ---------------------------------------------------------------------------
// useRecommender — generate strategy candidates and run MC per candidate
// ---------------------------------------------------------------------------

import { useState, useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import { generateOptionChain } from "@/lib/optionChain";
import { recommendStrategies } from "@/lib/recommender";
import type { SimulationResult, RecommendedStrategy } from "@/lib/types";

function uncertaintyToVol(level: number): number {
  return 0.2 + (level / 100) * 0.4;
}

function isoToYears(isoDate: string): number {
  const ms = new Date(isoDate).getTime() - Date.now();
  return Math.max(0.01, ms / (365.25 * 86_400_000));
}

interface UseRecommenderReturn {
  generate: () => void;
  isGenerating: boolean;
  progress: number; // 0-100
  error: string | null;
}

export function useRecommender(): UseRecommenderReturn {
  const {
    selectedSymbol,
    scenario,
    constraints,
    setCandidates,
    updateCandidate,
  } = useStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const generate = useCallback(() => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    // Build initial candidates synchronously
    let initialCandidates: RecommendedStrategy[];
    try {
      const chain = generateOptionChain(selectedSymbol);
      initialCandidates = recommendStrategies(scenario, chain, constraints);
    } catch (e) {
      setError("Failed to generate strategies. Please try again.");
      setIsGenerating(false);
      return;
    }

    setCandidates(initialCandidates);

    if (initialCandidates.length === 0) {
      setIsGenerating(false);
      setProgress(100);
      return;
    }

    // Spawn a single worker and simulate candidates sequentially
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker("/workers/monte-carlo.js");
    workerRef.current = worker;

    let idx = 0;
    const total = initialCandidates.length;

    function runNext() {
      if (idx >= total) {
        worker.terminate();
        workerRef.current = null;
        setIsGenerating(false);
        setProgress(100);
        return;
      }

      const candidate = initialCandidates[idx];
      const legs = candidate.strategy.legs;
      const chain = generateOptionChain(selectedSymbol);
      const spot = chain.underlyingPrice;
      const vol = uncertaintyToVol(scenario.uncertaintyLevel ?? 20);

      // Pick T from the first leg's expiry
      const T = legs.length > 0 ? isoToYears(legs[0].expiry) : 0.08;

      worker.postMessage({
        spot,
        r: 0.02,
        vol,
        T,
        legs,
        numPaths: 5000,
      });
    }

    worker.onmessage = (e: MessageEvent<SimulationResult>) => {
      const candidate = initialCandidates[idx];
      updateCandidate(candidate.id, { simulation: e.data });
      idx++;
      setProgress(Math.round((idx / total) * 100));
      runNext();
    };

    worker.onerror = () => {
      worker.terminate();
      workerRef.current = null;
      setIsGenerating(false);
      setError("Simulation failed. Strategies shown without PoP/EV data.");
    };

    runNext();
  }, [selectedSymbol, scenario, constraints, setCandidates, updateCandidate]);

  return { generate, isGenerating, progress, error };
}
