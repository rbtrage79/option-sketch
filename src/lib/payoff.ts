// ---------------------------------------------------------------------------
// Strategy payoff utilities
//
// Payoff is always expressed as total P/L in dollars at expiry
// (intrinsic value of the option minus premium paid/received).
// 1 contract = 100 shares.
// ---------------------------------------------------------------------------

import type { OptionLeg } from "@/lib/types";

// ---------------------------------------------------------------------------
// Single-leg payoff
// ---------------------------------------------------------------------------

/**
 * P/L in dollars for one leg at a given spot price at expiry.
 */
export function legPayoffAtExpiry(leg: OptionLeg, spotAtExpiry: number): number {
  const intrinsic =
    leg.type === "call"
      ? Math.max(0, spotAtExpiry - leg.strike)
      : Math.max(0, leg.strike - spotAtExpiry);

  const direction = leg.side === "long" ? 1 : -1;
  // (intrinsic value - premium paid) × 100 shares × qty contracts
  return direction * (intrinsic - leg.premium) * 100 * leg.qty;
}

// ---------------------------------------------------------------------------
// Multi-leg strategy payoff
// ---------------------------------------------------------------------------

/**
 * Total P/L in dollars for the entire strategy at expiry.
 */
export function strategyPayoffAtExpiry(
  legs: OptionLeg[],
  spotAtExpiry: number
): number {
  if (legs.length === 0) return 0;
  return legs.reduce((sum, leg) => sum + legPayoffAtExpiry(leg, spotAtExpiry), 0);
}

// ---------------------------------------------------------------------------
// Theoretical max gain / max loss
// ---------------------------------------------------------------------------

/**
 * Scan payoff over a wide spot range to derive max gain / max loss.
 * Returns `null` for unlimited (payoff keeps changing at the edge of the scan).
 */
export function computeMaxGainLoss(
  legs: OptionLeg[],
  spot: number
): { maxGain: number | null; maxLoss: number | null } {
  if (legs.length === 0) return { maxGain: 0, maxLoss: 0 };

  const maxStrike = Math.max(...legs.map((l) => l.strike));
  const scanMax = 4 * maxStrike; // scan up to 4× the highest strike
  const steps = 2000;

  let globalMin = Infinity;
  let globalMax = -Infinity;

  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * scanMax;
    const pnl = strategyPayoffAtExpiry(legs, s);
    if (pnl < globalMin) globalMin = pnl;
    if (pnl > globalMax) globalMax = pnl;
  }

  // Detect "unlimited": payoff is still changing at the extreme edge
  const nearZeroPnl = strategyPayoffAtExpiry(legs, 0.001);
  const atMaxPnl = strategyPayoffAtExpiry(legs, scanMax);
  const nearMaxPnl = strategyPayoffAtExpiry(legs, scanMax * 0.995);

  // If payoff at spot→0 is still moving toward the global min, loss is bounded
  // (puts are bounded since spot can't go below 0)
  const isUnlimitedGain = Math.abs(atMaxPnl - nearMaxPnl) > 0.5 * Math.abs(globalMax / steps);

  // Unlimited loss: payoff keeps falling as spot rises (naked short call)
  const isUnlimitedLoss = isUnlimitedGain
    ? false // if gain is unlimited, loss is bounded (can't both be unlimited for standard strategies)
    : atMaxPnl < globalMin - 0.5; // crude check — payoff fell below the scan minimum

  return {
    maxGain: isUnlimitedGain ? null : +globalMax.toFixed(2),
    maxLoss: isUnlimitedLoss ? null : +globalMin.toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// Breakeven detection
// ---------------------------------------------------------------------------

/**
 * Find spot prices where P/L = 0 by scanning for sign changes.
 * Works for any strategy (single-leg, spread, straddle, etc.).
 */
export function computeBreakevens(
  legs: OptionLeg[],
  spot: number
): number[] {
  if (legs.length === 0) return [];

  const maxStrike = Math.max(...legs.map((l) => l.strike));
  const scanMax = 3 * maxStrike;
  const steps = 4000;
  const breakevens: number[] = [];

  let prevPnl = strategyPayoffAtExpiry(legs, 0);

  for (let i = 1; i <= steps; i++) {
    const s = (i / steps) * scanMax;
    const pnl = strategyPayoffAtExpiry(legs, s);

    // Zero crossing: sign change OR exact zero after a non-zero value.
    // Using explicit comparisons to handle the exact-zero case that
    // `prevPnl * pnl < 0` misses when pnl is exactly 0.
    const crossed =
      (prevPnl > 0 && pnl <= 0) || (prevPnl < 0 && pnl >= 0);
    if (crossed && prevPnl !== pnl) {
      const prevS = ((i - 1) / steps) * scanMax;
      // Linear interpolation; if pnl == 0 the formula collapses to s exactly
      const denom = pnl - prevPnl;
      const be = denom !== 0 ? prevS - prevPnl * ((s - prevS) / denom) : s;
      // Deduplicate breakevens that are very close together
      if (breakevens.length === 0 || Math.abs(be - breakevens[breakevens.length - 1]) > 0.5) {
        breakevens.push(+be.toFixed(2));
      }
    }

    prevPnl = pnl;
  }

  return breakevens;
}
