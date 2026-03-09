"use client";

import { create } from "zustand";
import type {
  Scenario,
  DrawingTool,
  UIMode,
  RecommendedStrategy,
  Constraints,
  ChatMessage,
  HistoricalBar,
  OptionChain,
} from "@/lib/types";

export type MarketStatus = "idle" | "loading" | "ready" | "error";

interface StoreState {
  // ── Core data ─────────────────────────────────────────────────────────────
  selectedSymbol: string;
  scenario: Partial<Scenario>;

  // ── Market data (live or mock) ─────────────────────────────────────────────
  bars: HistoricalBar[];
  chain: OptionChain | null;
  marketStatus: MarketStatus;
  marketError: string | null;

  // ── Recommendation state ──────────────────────────────────────────────────
  candidates: RecommendedStrategy[];
  constraints: Constraints;

  // ── Chat state ────────────────────────────────────────────────────────────
  chatMessages: ChatMessage[];

  // ── UI ────────────────────────────────────────────────────────────────────
  activeTool: DrawingTool;
  uiMode: UIMode;

  // ── Actions ───────────────────────────────────────────────────────────────
  setSymbol: (symbol: string) => void;
  updateScenario: (updates: Partial<Scenario>) => void;
  resetScenario: () => void;
  setActiveTool: (tool: DrawingTool) => void;
  setUIMode: (mode: UIMode) => void;

  setMarketData: (bars: HistoricalBar[], chain: OptionChain) => void;
  setMarketStatus: (status: MarketStatus, error?: string | null) => void;

  setCandidates: (candidates: RecommendedStrategy[]) => void;
  updateCandidate: (id: string, patch: Partial<RecommendedStrategy>) => void;
  clearCandidates: () => void;

  setConstraints: (constraints: Constraints) => void;

  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
}

const defaultScenario: Partial<Scenario> = {
  symbol: "SPY",
  uncertaintyLevel: 20,
};

export const useStore = create<StoreState>((set) => ({
  selectedSymbol: "SPY",
  scenario: { ...defaultScenario },
  bars: [],
  chain: null,
  marketStatus: "idle",
  marketError: null,
  candidates: [],
  constraints: {},
  chatMessages: [],
  activeTool: "none",
  uiMode: "simple",

  setSymbol: (symbol) =>
    set(() => ({
      selectedSymbol: symbol,
      scenario: { symbol, uncertaintyLevel: 20 },
      candidates: [],
      bars: [],
      chain: null,
      marketStatus: "idle",
      marketError: null,
    })),

  updateScenario: (updates) =>
    set((state) => ({ scenario: { ...state.scenario, ...updates } })),

  resetScenario: () =>
    set((state) => ({
      scenario: { symbol: state.selectedSymbol, uncertaintyLevel: 20 },
      activeTool: "none",
      candidates: [],
    })),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setUIMode: (mode) => set({ uiMode: mode }),

  setMarketData: (bars, chain) =>
    set({ bars, chain, marketStatus: "ready", marketError: null }),

  setMarketStatus: (status, error = null) =>
    set({ marketStatus: status, marketError: error }),

  setCandidates: (candidates) => set({ candidates }),
  updateCandidate: (id, patch) =>
    set((state) => ({
      candidates: state.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  clearCandidates: () => set({ candidates: [] }),

  setConstraints: (constraints) => set({ constraints }),

  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [] }),
}));
