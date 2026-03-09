// ---------------------------------------------------------------------------
// Yahoo Finance API client
//
// Fetches real OHLCV bars and options chains from Yahoo Finance.
// Falls back to mock data on any network / CORS failure.
//
// Strategy:
//  1. Try direct fetch to Yahoo Finance (works in many environments)
//  2. On failure, retry via corsproxy.io (handles CORS)
//  3. If both fail, throw so callers can fall back to mock data
// ---------------------------------------------------------------------------

import type { HistoricalBar, OptionChain, OptionContract } from "@/lib/types";
import { blackScholes } from "@/lib/blackScholes";

// ---------------------------------------------------------------------------
// CORS-aware fetch helper
// ---------------------------------------------------------------------------

const CORS_PROXY = "https://corsproxy.io/?";

async function yfFetch(url: string): Promise<Response> {
  // First try direct
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return res;
  } catch {
    // CORS or network failure — fall through to proxy
  }

  // Retry via CORS proxy
  const proxied = CORS_PROXY + encodeURIComponent(url);
  const res = await fetch(proxied, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);
  return res;
}

// ---------------------------------------------------------------------------
// Historical bars  (v8/finance/chart)
// ---------------------------------------------------------------------------

interface YFChartResponse {
  chart: {
    result?: Array<{
      meta: { regularMarketPrice: number; symbol: string };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
    error?: { code: string; description: string } | null;
  };
}

/**
 * Fetch 6 months of daily OHLCV bars for a symbol.
 * Returns an array sorted by time ascending.
 */
export async function fetchBars(symbol: string): Promise<HistoricalBar[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
    `?interval=1d&range=6mo&includePrePost=false`;

  const res = await yfFetch(url);
  const json: YFChartResponse = await res.json();

  const result = json.chart.result?.[0];
  if (!result) throw new Error("No chart data returned");

  const { timestamp, indicators } = result;
  const quote = indicators.quote[0];

  const bars: HistoricalBar[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const o = quote.open[i];
    const h = quote.high[i];
    const l = quote.low[i];
    const c = quote.close[i];
    const v = quote.volume[i];
    // Skip bars with null values (market holidays etc.)
    if (o == null || h == null || l == null || c == null || v == null) continue;
    bars.push({ time: timestamp[i], open: o, high: h, low: l, close: c, volume: v });
  }

  if (bars.length === 0) throw new Error("Empty bars data");
  return bars;
}

// ---------------------------------------------------------------------------
// Options chain  (v7/finance/options)
// ---------------------------------------------------------------------------

interface YFOptionContract {
  strike: number;
  bid: number;
  ask: number;
  impliedVolatility: number;
  openInterest: number;
  volume?: number;
  expiration: number; // unix seconds
}

interface YFOptionsResponse {
  optionChain: {
    result?: Array<{
      underlyingSymbol: string;
      expirationDates: number[]; // unix timestamps
      strikes: number[];
      quote: {
        regularMarketPrice: number;
      };
      options: Array<{
        expirationDate: number;
        calls: YFOptionContract[];
        puts: YFOptionContract[];
      }>;
    }>;
    error?: unknown;
  };
}

/**
 * Fetch options chain for a symbol.
 * Retrieves up to 4 expiries (similar cadence to mock: ~14, 28, 56, 84 DTE).
 * Greeks are computed locally via Black-Scholes using YF's impliedVolatility.
 */
export async function fetchOptionChain(symbol: string, r = 0.02): Promise<OptionChain> {
  // ── Step 1: fetch default (nearest) expiry to get quote + expiration list ──
  const baseUrl = `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`;
  const baseRes = await yfFetch(baseUrl);
  const baseJson: YFOptionsResponse = await baseRes.json();

  const baseResult = baseJson.optionChain.result?.[0];
  if (!baseResult) throw new Error("No options data returned");

  const spot = baseResult.quote.regularMarketPrice;
  const allExpiries = baseResult.expirationDates; // sorted unix timestamps

  if (allExpiries.length === 0) throw new Error("No expiration dates");

  const now = Date.now() / 1000;

  // ── Step 2: pick up to 4 expiries spread over 14, 28, 56, 84 DTE ──────────
  const targets = [14, 28, 56, 84];
  const pickedTimestamps: number[] = [];

  for (const daysOut of targets) {
    const targetTs = now + daysOut * 86400;
    const best = allExpiries.reduce((a, b) =>
      Math.abs(b - targetTs) < Math.abs(a - targetTs) ? b : a
    );
    if (!pickedTimestamps.includes(best)) pickedTimestamps.push(best);
  }

  // ── Step 3: fetch each expiry (first one may already be in baseResult) ─────
  const chains: Record<string, OptionContract[]> = {};
  const expirations: string[] = [];

  for (const ts of pickedTimestamps) {
    const expiryISO = new Date(ts * 1000).toISOString().slice(0, 10);
    expirations.push(expiryISO);

    // Check if this expiry's data is already in the base result
    const existing = baseResult.options.find((o) => o.expirationDate === ts);
    let calls: YFOptionContract[];
    let puts: YFOptionContract[];

    if (existing) {
      calls = existing.calls;
      puts = existing.puts;
    } else {
      // Fetch this specific expiry
      const url = `${baseUrl}?date=${ts}`;
      try {
        const res = await yfFetch(url);
        const json: YFOptionsResponse = await res.json();
        const result = json.optionChain.result?.[0];
        if (!result || result.options.length === 0) {
          chains[expiryISO] = [];
          continue;
        }
        calls = result.options[0].calls;
        puts = result.options[0].puts;
      } catch {
        chains[expiryISO] = [];
        continue;
      }
    }

    // ── Step 4: convert to OptionContract, compute Greeks via B-S ────────────
    const T = Math.max(0.001, (ts - now) / (365.25 * 86400));
    const contracts: OptionContract[] = [];

    const convertContracts = (raw: YFOptionContract[], type: "call" | "put") => {
      for (const c of raw) {
        const strike = c.strike;
        const bid = Math.max(0, c.bid ?? 0);
        const ask = Math.max(0, c.ask ?? 0);
        // YF sometimes returns 0 IV for deep OTM; use a floor
        const iv = Math.max(0.05, c.impliedVolatility ?? 0.30);
        const oi = c.openInterest ?? 0;
        const volume = c.volume ?? 0;

        // Skip clearly broken contracts
        if (strike <= 0 || (bid === 0 && ask === 0)) continue;

        const bs = blackScholes(spot, strike, T, r, iv, type);

        contracts.push({
          strike,
          expiry: expiryISO,
          type,
          bid: +bid.toFixed(2),
          ask: +ask.toFixed(2),
          iv: +iv.toFixed(4),
          delta: bs.delta,
          gamma: bs.gamma,
          theta: bs.theta,
          vega: bs.vega,
          openInterest: oi,
          volume,
        });
      }
    };

    convertContracts(calls, "call");
    convertContracts(puts, "put");

    chains[expiryISO] = contracts;
  }

  return { symbol, underlyingPrice: spot, expirations, chains };
}
