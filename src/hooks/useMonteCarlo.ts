"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SimulationResult, OptionLeg } from "@/lib/types";

export interface MCInput {
  spot: number;
  r?: number;
  vol: number;
  /** Time to target in years. */
  T: number;
  legs: OptionLeg[];
  numPaths?: number;
}

type WorkerMessage =
  | {
      pop: number;
      ev: number;
      maxGain: number | null;
      maxLoss: number | null;
      breakevens: number[];
      percentiles: {
        p5: number;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
      };
      histogram: { x: number; count: number }[];
      underlyingSample: number[];
      durationMs: number;
    }
  | { error: string };

export function useMonteCarlo() {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const workerPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/workers/monte-carlo.js`;
    const worker = new Worker(workerPath);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      if ("error" in data) {
        setError(data.error);
        setIsRunning(false);
        return;
      }
      setResult({
        pop: data.pop,
        ev: data.ev,
        maxGain: data.maxGain,
        maxLoss: data.maxLoss,
        breakevens: data.breakevens,
        percentiles: data.percentiles,
        histogram: data.histogram,
        underlyingSample: data.underlyingSample,
        durationMs: data.durationMs,
      });
      setIsRunning(false);
    };

    worker.onerror = (e) => {
      setError(`Worker error: ${e.message}`);
      setIsRunning(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const simulate = useCallback((input: MCInput) => {
    if (!workerRef.current) return;
    setIsRunning(true);
    setError(null);
    workerRef.current.postMessage({
      spot: input.spot,
      r: input.r ?? 0.02,
      vol: input.vol,
      T: input.T,
      legs: input.legs,
      numPaths: input.numPaths ?? 20_000,
    });
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { simulate, reset, result, isRunning, error };
}
