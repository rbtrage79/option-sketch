"use client";

import { create } from "zustand";
import type {
  Scenario,
  DrawingTool,
  UIMode,
  RecommendedStrategy,
  Constraints,
  ChatMessage,
} from "@/lib/types";

interface StoreState {
  // ── Core data ─────────────────────────────────────────────────────────────
  selectedSymbol: string;
  scenario: Partial<Scenario>;

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
  candidates: [],
  constraints: {},
  chatMessages: [],
  activeTool: "none",
  uiMode: "simple",

  setSymbol: (symbol) =>
    set((state) => ({
      selectedSymbol: symbol,
      scenario: { symbol, uncertaintyLevel: state.scenario.uncertaintyLevel ?? 20 },
      candidates: [],
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
