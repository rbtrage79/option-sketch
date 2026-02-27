import type { HistoricalBar } from "@/lib/types";

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (LCG)
// ---------------------------------------------------------------------------
function seededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    state >>>= 0; // keep as uint32
    return state / 0xffffffff;
  };
}

function symbolToSeed(symbol: string): number {
  return symbol
    .split("")
    .reduce((acc, ch) => Math.imul(acc, 31) + ch.charCodeAt(0), 7);
}

// Starting prices per symbol so the mocked data looks realistic
const INITIAL_PRICES: Record<string, number> = {
  SPY: 452,
  AAPL: 183,
  TSLA: 258,
};

/**
 * Generates `numBars` trading days of synthetic OHLCV data ending today,
 * seeded deterministically from `symbol`.
 */
export function generateMockBars(
  symbol: string,
  numBars = 90
): HistoricalBar[] {
  const rand = seededRng(symbolToSeed(symbol));

  // Derive per-symbol characteristics from the seed so they differ
  const drift = (rand() - 0.5) * 0.0004; // slight daily drift
  const baseVol = 0.012 + rand() * 0.008; // 1.2% – 2.0% daily vol

  let close = INITIAL_PRICES[symbol] ?? 100 + rand() * 200;
  const bars: HistoricalBar[] = [];

  // Walk backwards from today so we end with today as the last bar
  const endMs = Date.now();
  const msPerDay = 86_400_000;

  // Collect dates skipping weekends, going far enough back
  const tradingDays: Date[] = [];
  let cursor = new Date(endMs);
  cursor.setHours(0, 0, 0, 0);

  while (tradingDays.length < numBars) {
    cursor = new Date(cursor.getTime() - msPerDay);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) tradingDays.push(new Date(cursor));
  }
  tradingDays.reverse(); // oldest first

  // Run a forward random walk
  for (const day of tradingDays) {
    const r = rand();
    const dailyReturn = drift + (r * 2 - 1) * baseVol;
    const gapVol = baseVol * 0.3;

    const open = close * (1 + (rand() - 0.5) * gapVol);
    close = open * (1 + dailyReturn);

    const intraRange = Math.abs(open - close) + rand() * open * 0.006;
    const high = Math.max(open, close) + rand() * intraRange;
    const low = Math.min(open, close) - rand() * intraRange;

    const baseVolume = symbol === "SPY" ? 60_000_000 : 30_000_000;
    const volume = Math.floor((0.4 + rand() * 1.2) * baseVolume);

    bars.push({
      time: Math.floor(day.getTime() / 1000),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });
  }

  return bars;
}

/**
 * Generates future trading-day date strings (YYYY-MM-DD) starting the day
 * after `lastBarDate`, for `numFutureDays` trading days.
 */
export function generateFutureDates(
  lastBarDate: Date,
  numFutureDays = 60
): string[] {
  const dates: string[] = [];
  const cursor = new Date(lastBarDate);
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < numFutureDays) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
  }
  return dates;
}
