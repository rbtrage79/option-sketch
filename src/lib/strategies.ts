// ---------------------------------------------------------------------------
// Predefined option strategy builders
//
// Each builder selects appropriate legs from the generated option chain
// given a target expiry date closest to the user's drawn scenario.
// ---------------------------------------------------------------------------

import type { OptionChain, OptionContract, Strategy } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the contract closest to the given strike. */
function nearestStrike(
  contracts: OptionContract[],
  type: "call" | "put",
  targetStrike: number
): OptionContract {
  const filtered = contracts.filter((c) => c.type === type);
  return filtered.reduce((best, c) =>
    Math.abs(c.strike - targetStrike) < Math.abs(best.strike - targetStrike)
      ? c
      : best
  );
}

/** Mid-price of a contract. */
function mid(c: OptionContract): number {
  return +((c.bid + c.ask) / 2).toFixed(2);
}

/** Pick the expiry from the chain that is closest to targetDaysOut. */
export function pickExpiry(
  expirations: string[],
  targetDaysOut: number
): string {
  const today = Date.now();
  return expirations.reduce((best, exp) => {
    const dBest = Math.abs((new Date(best).getTime() - today) / 86_400_000 - targetDaysOut);
    const dCurr = Math.abs((new Date(exp).getTime() - today) / 86_400_000 - targetDaysOut);
    return dCurr < dBest ? exp : best;
  });
}

// ---------------------------------------------------------------------------
// Strategy catalogue
// ---------------------------------------------------------------------------

export interface StrategyDef {
  id: string;
  name: string;
  description: string;
  bias: Strategy["bias"];
  riskLabel: string;
  build: (chain: OptionChain, expiry: string) => Strategy;
}

export const STRATEGY_DEFS: StrategyDef[] = [
  // ── Bullish ────────────────────────────────────────────────────────────────
  {
    id: "long-call",
    name: "Long ATM Call",
    description: "Buy 1 call near-the-money. Unlimited upside; risk limited to premium.",
    bias: "bullish",
    riskLabel: "Theta decay accelerates near expiry",
    build(chain, expiry) {
      const c = nearestStrike(chain.chains[expiry], "call", chain.underlyingPrice);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [{ type: "call", side: "long", strike: c.strike, premium: mid(c), expiry, qty: 1 }],
      };
    },
  },
  {
    id: "bull-call-spread",
    name: "Bull Call Spread",
    description: "Long ATM call + short OTM call (~5% higher strike). Defined risk/reward.",
    bias: "bullish",
    riskLabel: "Max profit capped at spread width minus net debit",
    build(chain, expiry) {
      const spot = chain.underlyingPrice;
      const longLeg = nearestStrike(chain.chains[expiry], "call", spot);
      const shortLeg = nearestStrike(chain.chains[expiry], "call", spot * 1.05);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [
          { type: "call", side: "long", strike: longLeg.strike, premium: mid(longLeg), expiry, qty: 1 },
          { type: "call", side: "short", strike: shortLeg.strike, premium: mid(shortLeg), expiry, qty: 1 },
        ],
      };
    },
  },
  {
    id: "covered-call",
    name: "Covered Call",
    description:
      "Simulates selling an OTM call against existing stock. Limited upside past short strike.",
    bias: "neutral",
    riskLabel: "Upside capped; still exposed to stock downside",
    build(chain, expiry) {
      const spot = chain.underlyingPrice;
      const shortLeg = nearestStrike(chain.chains[expiry], "call", spot * 1.05);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [
          // Short call only (the long stock leg is implied; not modelled here)
          { type: "call", side: "short", strike: shortLeg.strike, premium: mid(shortLeg), expiry, qty: 1 },
        ],
      };
    },
  },
  // ── Bearish ────────────────────────────────────────────────────────────────
  {
    id: "long-put",
    name: "Long ATM Put",
    description: "Buy 1 put near-the-money. Profits on decline; risk limited to premium.",
    bias: "bearish",
    riskLabel: "Theta decay accelerates near expiry",
    build(chain, expiry) {
      const c = nearestStrike(chain.chains[expiry], "put", chain.underlyingPrice);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [{ type: "put", side: "long", strike: c.strike, premium: mid(c), expiry, qty: 1 }],
      };
    },
  },
  {
    id: "bear-put-spread",
    name: "Bear Put Spread",
    description: "Long ATM put + short OTM put (~5% lower strike). Defined risk/reward.",
    bias: "bearish",
    riskLabel: "Max profit capped at spread width minus net debit",
    build(chain, expiry) {
      const spot = chain.underlyingPrice;
      const longLeg = nearestStrike(chain.chains[expiry], "put", spot);
      const shortLeg = nearestStrike(chain.chains[expiry], "put", spot * 0.95);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [
          { type: "put", side: "long", strike: longLeg.strike, premium: mid(longLeg), expiry, qty: 1 },
          { type: "put", side: "short", strike: shortLeg.strike, premium: mid(shortLeg), expiry, qty: 1 },
        ],
      };
    },
  },
  // ── Volatility ─────────────────────────────────────────────────────────────
  {
    id: "atm-straddle",
    name: "ATM Straddle",
    description:
      "Long ATM call + long ATM put. Profits from large moves in either direction.",
    bias: "volatile",
    riskLabel: "IV crush risk; needs large move to be profitable",
    build(chain, expiry) {
      const spot = chain.underlyingPrice;
      const call = nearestStrike(chain.chains[expiry], "call", spot);
      const put = nearestStrike(chain.chains[expiry], "put", spot);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [
          { type: "call", side: "long", strike: call.strike, premium: mid(call), expiry, qty: 1 },
          { type: "put", side: "long", strike: put.strike, premium: mid(put), expiry, qty: 1 },
        ],
      };
    },
  },
  {
    id: "atm-strangle",
    name: "OTM Strangle",
    description:
      "Long OTM call (~5% above) + long OTM put (~5% below). Cheaper than straddle; needs bigger move.",
    bias: "volatile",
    riskLabel: "Both options expire worthless if the move is not large enough",
    build(chain, expiry) {
      const spot = chain.underlyingPrice;
      const call = nearestStrike(chain.chains[expiry], "call", spot * 1.05);
      const put = nearestStrike(chain.chains[expiry], "put", spot * 0.95);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [
          { type: "call", side: "long", strike: call.strike, premium: mid(call), expiry, qty: 1 },
          { type: "put", side: "long", strike: put.strike, premium: mid(put), expiry, qty: 1 },
        ],
      };
    },
  },
  {
    id: "butterfly",
    name: "Long Call Butterfly",
    description:
      "Long lower call + short 2× ATM calls + long upper call. Profits if stock stays near current price.",
    bias: "neutral",
    riskLabel: "Max gain only near ATM strike at expiry; low probability of peak payoff",
    build(chain, expiry) {
      const spot = chain.underlyingPrice;
      const lower = nearestStrike(chain.chains[expiry], "call", spot * 0.95);
      const atm = nearestStrike(chain.chains[expiry], "call", spot);
      const upper = nearestStrike(chain.chains[expiry], "call", spot * 1.05);
      return {
        id: this.id,
        name: this.name,
        description: this.description,
        bias: this.bias,
        legs: [
          { type: "call", side: "long",  strike: lower.strike, premium: mid(lower), expiry, qty: 1 },
          { type: "call", side: "short", strike: atm.strike,   premium: mid(atm),   expiry, qty: 2 },
          { type: "call", side: "long",  strike: upper.strike, premium: mid(upper), expiry, qty: 1 },
        ],
      };
    },
  },
];

export function getStrategyById(id: string): StrategyDef | undefined {
  return STRATEGY_DEFS.find((s) => s.id === id);
}

/** Build a concrete Strategy from a definition, chain, and expiry. */
export function buildStrategy(
  defId: string,
  chain: OptionChain,
  expiry: string
): Strategy | null {
  const def = getStrategyById(defId);
  if (!def || !chain.chains[expiry]) return null;
  try {
    return def.build(chain, expiry);
  } catch {
    return null;
  }
}

export const DEFAULT_STRATEGY_ID = "long-call";
