// ---------------------------------------------------------------------------
// Core domain types for OptionSketch
// ---------------------------------------------------------------------------

/** A single OHLCV bar from a price feed (historical or synthetic). */
export interface HistoricalBar {
  /** Unix timestamp in seconds (UTC midnight). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** A single point in a drawn price path. */
export interface PathPoint {
  /** ISO-8601 date string, e.g. "2024-12-31". */
  dateISO: string;
  price: number;
}

export type ScenarioKind = "pointTarget" | "path";

export type DrawingTool = "none" | "targetPoint" | "path";

/**
 * The user's drawn scenario – what they think the stock will do.
 * Validated by the Zod schema in schema.ts before generating strategies.
 */
export interface Scenario {
  kind: ScenarioKind;
  symbol: string;
  /** ISO date of the target (last path point, or single target date). */
  targetDate: string;
  /** For pointTarget: the desired price. */
  targetPrice?: number;
  /** For path: ordered list of drawn price waypoints (future dates). */
  pathPoints?: PathPoint[];
  /** 0 = very confident, 100 = very uncertain. */
  uncertaintyLevel: number;
}

// ---------------------------------------------------------------------------
// Option chain interfaces – data shapes only; no data generated in Step 1.
// TODO (Step 2): populate from mock OptionChain data or live API.
// ---------------------------------------------------------------------------

export interface OptionContract {
  strike: number;
  /** ISO date string. */
  expiry: string;
  type: "call" | "put";
  bid: number;
  ask: number;
  /** Implied volatility as decimal (0.25 = 25%). */
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  openInterest: number;
  volume: number;
}

export interface OptionChain {
  symbol: string;
  underlyingPrice: number;
  /** Available expiry dates (ISO). */
  expirations: string[];
  /** Keyed by expiry ISO date. */
  chains: Record<string, OptionContract[]>;
}

// ---------------------------------------------------------------------------
// Option legs & strategies (used for payoff + simulation)
// ---------------------------------------------------------------------------

/** A single option leg in a multi-leg strategy. */
export interface OptionLeg {
  type: "call" | "put";
  side: "long" | "short";
  strike: number;
  /** Mid-market premium per share. */
  premium: number;
  /** ISO date of expiration. */
  expiry: string;
  /** Number of contracts (1 contract = 100 shares). */
  qty: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  /** Approximate directional bias for display. */
  bias: "bullish" | "bearish" | "neutral" | "volatile";
  legs: OptionLeg[];
}

// ---------------------------------------------------------------------------
// Monte Carlo simulation types
// ---------------------------------------------------------------------------

export interface SimulationInput {
  spot: number;
  r: number;
  vol: number;
  /** Time to target in years. */
  T: number;
  legs: OptionLeg[];
  numPaths: number;
}

export interface SimulationResult {
  /** Fraction of paths with P/L > 0. */
  pop: number;
  /** Mean P/L across all paths (dollars). */
  ev: number;
  /** Maximum theoretical loss (null = unlimited). */
  maxLoss: number | null;
  /** Maximum theoretical gain (null = unlimited). */
  maxGain: number | null;
  /** Breakeven spot prices at expiry. */
  breakevens: number[];
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  /** Pre-computed histogram bins for distribution chart. */
  histogram: { x: number; count: number }[];
  /** Sampled terminal underlying prices (subset for UI rendering). */
  underlyingSample: number[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// UI-only types
// ---------------------------------------------------------------------------

export type UIMode = "simple" | "advanced";
export type SimMode = "simple" | "advanced";
export type SidebarTab = "draw" | "chat" | "strategies";
export type CandidateBias = "up" | "down" | "neutral" | "volatile";

export const SYMBOLS = [
  "SPY", "QQQ", "IWM",
  "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD",
  "NFLX", "CRM",
] as const;
export type Symbol = (typeof SYMBOLS)[number];

/** Popular symbols shown as quick-pick chips on the home page */
export const POPULAR_SYMBOLS = ["SPY", "QQQ", "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META"] as const;

// ---------------------------------------------------------------------------
// Strategy recommendation types (Step 3)
// ---------------------------------------------------------------------------

/** Hard constraints supplied by the user (from Guided Q&A or chat). */
export interface Constraints {
  /** Maximum acceptable debit, in dollars per position. */
  maxDebitDollars?: number;
  /** Prefer strategies where max loss is defined up-front. */
  preferDefinedRisk?: boolean;
  /** User's view on near-term implied volatility. */
  volatilityView?: "low" | "normal" | "high";
}

/** A strategy candidate returned by the recommender. */
export interface RecommendedStrategy {
  /** Unique key, e.g. "long-call-2024-03-15" */
  id: string;
  strategy: Strategy;
  /** Net cost per position in dollars. Negative = debit, positive = credit. */
  netDebitCredit: number;
  maxLoss: number | null;
  maxGain: number | null;
  breakevens: number[];
  /** 3-4 short bullets explaining why this fits the scenario. */
  rationale: string[];
  /** 2 short risk bullets. */
  risks: string[];
  fit: "strong" | "moderate";
  fitScore: number; // 0-100
  /** Populated asynchronously after MC simulation. */
  simulation?: SimulationResult;
}

// ---------------------------------------------------------------------------
// Chat + Guided Q&A types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

/** Parsed scenario from natural language input. */
export interface ParseResult {
  direction?: CandidateBias;
  magnitudePct?: number;
  targetPrice?: number;
  targetDate?: string; // ISO YYYY-MM-DD
  ambiguous: boolean;
  confidence: "high" | "medium" | "low";
  parsedFields: ("direction" | "magnitude" | "timeframe")[];
  hint?: string;
}

/** Guided Q&A answers (all optional — user may skip steps). */
export interface QAAnswers {
  direction?: CandidateBias;
  magnitudePct?: number;
  weeksOut?: number;
  volatilityView?: "low" | "normal" | "high";
  maxBudgetDollars?: number;
}
