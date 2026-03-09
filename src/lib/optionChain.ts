// ---------------------------------------------------------------------------
// Mock option chain generator
//
// Generates deterministic, realistic-looking bid/ask/IV using Black-Scholes
// with a volatility smile. Seeded per (symbol, expiry, strike) for consistency.
// ---------------------------------------------------------------------------

import type { OptionChain, OptionContract } from "@/lib/types";
import { blackScholes } from "@/lib/blackScholes";
import { generateMockBars } from "@/lib/mockData";

// ---------------------------------------------------------------------------
// Per-symbol baseline implied volatility (ATM, ~30-day)
// ---------------------------------------------------------------------------
const BASE_IV: Record<string, number> = {
  // ETFs — generally lower IV
  SPY: 0.17,
  QQQ: 0.20,
  IWM: 0.22,
  DIA: 0.16,
  // Mega-cap tech
  AAPL: 0.27,
  MSFT: 0.25,
  NVDA: 0.48,
  AMZN: 0.30,
  GOOGL: 0.28,
  META: 0.33,
  TSLA: 0.55,
  AMD: 0.50,
  // Other
  NFLX: 0.38,
  CRM: 0.30,
  BABA: 0.42,
};

// ---------------------------------------------------------------------------
// Seeded RNG (same LCG as mockData for reproducibility)
// ---------------------------------------------------------------------------
function seededRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function strToSeed(str: string): number {
  return str.split("").reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) >>> 0, 7);
}

// ---------------------------------------------------------------------------
// Volatility smile: skew + smile (quadratic in log-moneyness)
// ---------------------------------------------------------------------------
function smileIV(baseIV: number, S: number, K: number, T: number): number {
  const logMoney = Math.log(K / S);
  // Symmetric smile + mild put-side skew
  const smile = 0.6 * logMoney * logMoney + 0.05 * logMoney;
  // Adjust smile amplitude by term structure (shorter term = more pronounced)
  const termFactor = 1 + 0.3 * (1 / Math.max(T, 0.02));
  return Math.max(0.05, baseIV * (1 + smile * termFactor));
}

// ---------------------------------------------------------------------------
// Expiry date generation
// ---------------------------------------------------------------------------

/**
 * Returns 4 option expiry dates: 14, 28, 56, and 84 calendar days from today.
 */
export function generateExpiries(today = new Date()): string[] {
  return [14, 28, 56, 84].map((days) => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  });
}

// ---------------------------------------------------------------------------
// Full chain generator
// ---------------------------------------------------------------------------

/**
 * Generate a mocked but realistic option chain for the given symbol.
 * Prices are deterministic: same symbol always yields the same chain.
 *
 * @param symbol  Ticker symbol (SPY / AAPL / TSLA)
 * @param r       Risk-free rate (default 0.02)
 */
export function generateOptionChain(symbol: string, r = 0.02): OptionChain {
  const bars = generateMockBars(symbol, 1);
  const spot = bars[bars.length - 1].close;
  const baseIV = BASE_IV[symbol] ?? 0.30;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expirations = generateExpiries(today);
  const chains: Record<string, OptionContract[]> = {};

  for (const expiry of expirations) {
    const expiryDate = new Date(expiry);
    // Time to expiry in years
    const T = Math.max(0.001, (expiryDate.getTime() - today.getTime()) / (365.25 * 86_400_000));

    // Strike grid: -30% to +30% in ~2.5% increments → 25 strikes
    const strikeMults = Array.from({ length: 25 }, (_, i) => 0.70 + i * 0.025);

    // Round to sensible strike increments by price tier
    const inc = spot >= 300 ? 5 : spot >= 100 ? 2.5 : spot >= 50 ? 1 : 0.5;

    const contracts: OptionContract[] = [];

    for (const mult of strikeMults) {
      const rawStrike = spot * mult;
      const strike = Math.round(rawStrike / inc) * inc;

      const iv = smileIV(baseIV, spot, strike, T);

      // Seeded noise for bid/ask spread width (2–5% of mid)
      const rng = seededRng(strToSeed(`${symbol}|${expiry}|${strike}`));
      const spreadPct = 0.020 + rng() * 0.030;

      for (const type of ["call", "put"] as const) {
        const bs = blackScholes(spot, strike, T, r, iv, type);
        const mid = Math.max(0.01, bs.price);
        const halfSpread = Math.max(0.01, mid * spreadPct * 0.5);

        const bid = +Math.max(0.01, mid - halfSpread).toFixed(2);
        const ask = +(mid + halfSpread).toFixed(2);

        // Open interest: ATM peaks, falls off with distance from spot
        const atmDistance = Math.abs(Math.log(strike / spot));
        const oiPeak = symbol === "SPY" ? 50_000 : symbol === "AAPL" ? 30_000 : 15_000;
        const oi = Math.max(10, Math.floor(oiPeak * Math.exp(-4 * atmDistance) * (0.7 + rng() * 0.6)));
        const vol = Math.floor(oi * (0.05 + rng() * 0.15));

        contracts.push({
          strike,
          expiry,
          type,
          bid,
          ask,
          iv: +iv.toFixed(4),
          delta: bs.delta,
          gamma: bs.gamma,
          theta: bs.theta,
          vega: bs.vega,
          openInterest: oi,
          volume: vol,
        });
      }
    }

    chains[expiry] = contracts;
  }

  return { symbol, underlyingPrice: spot, expirations, chains };
}
