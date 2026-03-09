// ---------------------------------------------------------------------------
// Rule-based strategy recommender
//
// Given a scenario, option chain, and optional user constraints, returns
// 3-5 ranked strategy candidates with rationale and risk bullets.
// ---------------------------------------------------------------------------

import type {
  Scenario,
  OptionChain,
  Constraints,
  RecommendedStrategy,
  CandidateBias,
  Strategy,
} from "@/lib/types";
import { STRATEGY_DEFS, pickExpiry, buildStrategy } from "@/lib/strategies";
import {
  computeMaxGainLoss,
  computeBreakevens,
} from "@/lib/payoff";

// ---------------------------------------------------------------------------
// Scenario → bias inference
// ---------------------------------------------------------------------------

interface ScenarioBias {
  direction: CandidateBias;
  magnitudePct: number;
  daysOut: number;
  uncertaintyLevel: number;
}

function inferBias(
  scenario: Partial<Scenario>,
  spot: number
): ScenarioBias {
  const uncertaintyLevel = scenario.uncertaintyLevel ?? 30;
  let direction: CandidateBias = "neutral";
  let magnitudePct = 5;
  let daysOut = 30;

  // ── Direction + magnitude from targetPrice (pointTarget) ─────────────────
  if (scenario.kind === "pointTarget" && scenario.targetPrice != null) {
    const pct = ((scenario.targetPrice - spot) / spot) * 100;
    magnitudePct = Math.abs(pct);
    if (pct > 2) direction = "up";
    else if (pct < -2) direction = "down";
    else direction = "neutral";
  }

  // ── Direction + magnitude from path points ────────────────────────────────
  if (scenario.kind === "path" && scenario.pathPoints && scenario.pathPoints.length >= 2) {
    const first = scenario.pathPoints[0].price;
    const last = scenario.pathPoints[scenario.pathPoints.length - 1].price;
    const pct = ((last - first) / first) * 100;
    magnitudePct = Math.abs(pct);

    // Check for volatile path (multiple reversals)
    const reversals = scenario.pathPoints.reduce((count, pt, i, arr) => {
      if (i < 2) return count;
      const prev = arr[i - 1].price;
      const prevPrev = arr[i - 2].price;
      const d1 = prev - prevPrev;
      const d2 = pt.price - prev;
      return d1 * d2 < 0 ? count + 1 : count;
    }, 0);

    if (reversals >= 2) {
      direction = "volatile";
    } else if (pct > 2) {
      direction = "up";
    } else if (pct < -2) {
      direction = "down";
    } else {
      direction = "neutral";
    }
  }

  // High uncertainty with no clear direction → volatile
  if (uncertaintyLevel >= 65 && direction === "neutral") {
    direction = "volatile";
  }

  // ── Days to target ────────────────────────────────────────────────────────
  if (scenario.targetDate) {
    const msOut = new Date(scenario.targetDate).getTime() - Date.now();
    daysOut = Math.max(7, Math.round(msOut / 86_400_000));
  }

  return { direction, magnitudePct, daysOut, uncertaintyLevel };
}

// ---------------------------------------------------------------------------
// Net debit/credit calculation (positive = net credit)
// ---------------------------------------------------------------------------

function netDebit(strategy: Strategy): number {
  const cost = strategy.legs.reduce((sum, leg) => {
    const sign = leg.side === "long" ? -1 : 1; // long = debit (-), short = credit (+)
    return sum + sign * leg.premium * 100 * leg.qty;
  }, 0);
  return +cost.toFixed(2);
}

// ---------------------------------------------------------------------------
// Fit scoring
// ---------------------------------------------------------------------------

function computeFitScore(
  defId: string,
  defBias: Strategy["bias"],
  bias: ScenarioBias,
  maxGain: number | null,
  maxLoss: number | null,
  costPerPosition: number,
  constraints: Constraints
): number {
  let score = 0;

  // ── Direction alignment (50 pts) ──────────────────────────────────────────
  const directionMatrix: Record<string, Partial<Record<CandidateBias, number>>> = {
    bullish:  { up: 50, volatile: 20, neutral: 5,  down: 0  },
    bearish:  { down: 50, volatile: 20, neutral: 5, up: 0   },
    neutral:  { neutral: 45, up: 15, down: 15, volatile: 5  },
    volatile: { volatile: 50, up: 20, down: 20, neutral: 5  },
  };
  score += (directionMatrix[defBias] ?? {})[bias.direction] ?? 0;

  // ── Magnitude fit (20 pts) ────────────────────────────────────────────────
  const isSpread = defId.includes("spread");
  const isVolStrat = defId === "atm-straddle" || defId === "atm-strangle";
  const isLongSingle = defId === "long-call" || defId === "long-put";
  const isButterfly = defId === "butterfly";

  if (isLongSingle) {
    // Best for big moves
    score += bias.magnitudePct >= 8 ? 20 : bias.magnitudePct >= 4 ? 12 : 6;
  } else if (isSpread) {
    // Sweet spot: moderate moves 4-12%
    score +=
      bias.magnitudePct >= 4 && bias.magnitudePct <= 12
        ? 20
        : bias.magnitudePct < 4
        ? 10
        : 14;
  } else if (isVolStrat) {
    // Needs either high uncertainty OR large move
    const needsBigMove = bias.uncertaintyLevel >= 40 || bias.magnitudePct >= 6;
    score += needsBigMove ? 20 : 5;
  } else if (isButterfly) {
    // Neutral, low-move strategy — best for small expected moves
    score += bias.magnitudePct <= 3 ? 20 : bias.magnitudePct <= 6 ? 10 : 3;
  } else {
    score += 8; // generic default
  }

  // ── Defined risk preference (15 pts) ──────────────────────────────────────
  if (constraints.preferDefinedRisk) {
    score += maxLoss !== null ? 15 : 0;
  } else {
    score += 5;
  }

  // ── Cost constraint (15 pts) ──────────────────────────────────────────────
  if (constraints.maxDebitDollars !== undefined) {
    const absDebit = Math.abs(costPerPosition);
    if (absDebit <= constraints.maxDebitDollars) {
      score += 15;
    } else if (absDebit <= constraints.maxDebitDollars * 1.5) {
      score += 7;
    }
    // else 0
  } else {
    score += 8; // neutral
  }

  return Math.min(100, Math.round(score));
}

// ---------------------------------------------------------------------------
// Rationale + risks generation
// ---------------------------------------------------------------------------

function buildRationale(
  defId: string,
  defBias: Strategy["bias"],
  scenario: Partial<Scenario>,
  bias: ScenarioBias,
  netDebitAmt: number,
  maxGain: number | null,
  maxLoss: number | null,
  breakevens: number[]
): string[] {
  const sym = scenario.symbol ?? "the underlying";
  const dir = bias.direction;
  const pct = bias.magnitudePct.toFixed(1);
  const debitStr = `$${Math.abs(netDebitAmt).toFixed(0)}`;
  const gainStr = maxGain != null ? `$${maxGain.toFixed(0)}` : "unlimited";
  const lossStr = maxLoss != null ? `$${Math.abs(maxLoss).toFixed(0)}` : "unlimited";
  const beStr = breakevens.length > 0 ? `$${breakevens[0].toFixed(2)}` : "N/A";

  const bullets: string[] = [];

  switch (defId) {
    case "long-call":
      bullets.push(`Aligns with your ${dir === "up" ? "bullish" : "directional"} view — profits above ${beStr}`);
      bullets.push(`Unlimited upside beyond the strike; total risk capped at ${debitStr} premium paid`);
      bullets.push(`Controls 100 shares per contract with defined risk`);
      break;

    case "bull-call-spread":
      bullets.push(`Cost-effective for a moderate ${pct}% rise in ${sym}`);
      bullets.push(`Max gain ${gainStr} if ${sym} is above the short strike at expiry`);
      bullets.push(`Defined risk: max loss is the net debit of ${debitStr}`);
      bullets.push(`Spreads reduce premium cost vs. a naked long call`);
      break;

    case "covered-call":
      bullets.push(`Generates income via premium when you expect ${sym} to move modestly`);
      bullets.push(`Short call premium (${debitStr} credit) offsets cost basis`);
      bullets.push(`Best when you hold shares and expect sideways-to-slightly-up movement`);
      break;

    case "long-put":
      bullets.push(`Direct bearish play — profits below breakeven of ${beStr}`);
      bullets.push(`Risk capped at ${debitStr} premium; potential gain ${gainStr} if ${sym} falls`);
      bullets.push(`No shares needed; leverage allows participation in a downturn`);
      break;

    case "bear-put-spread":
      bullets.push(`Lower-cost bearish strategy for a ${pct}% expected decline`);
      bullets.push(`Max gain ${gainStr} if ${sym} is below the short put at expiry`);
      bullets.push(`Defined risk: max loss limited to ${debitStr} net debit`);
      bullets.push(`Reduces premium cost vs. a naked long put via short put premium`);
      break;

    case "atm-straddle":
      bullets.push(
        `Profits from large moves in either direction — aligns with high uncertainty (${bias.uncertaintyLevel}%)`
      );
      bullets.push(`Two breakevens: ${breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ")} — needs ${pct}%+ move`);
      bullets.push(`Combined debit ${debitStr}; profitable if IV expands or large price move occurs`);
      break;

    case "atm-strangle":
      bullets.push(`Cheaper than straddle; uses OTM options to reduce cost to ${debitStr}`);
      bullets.push(
        `Two breakevens: ${breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ")} — needs ${pct}%+ move`
      );
      bullets.push(`Benefits from IV expansion or a significant price shock`);
      break;

    case "butterfly":
      bullets.push(`Low-cost neutral strategy — ideal if you expect ${sym} to stay near current price`);
      bullets.push(`Max gain ${gainStr} if ${sym} is exactly at the middle strike at expiry`);
      bullets.push(`Risk capped at ${debitStr}; low cost relative to potential payoff`);
      break;

    default:
      bullets.push(`${defBias === "bullish" ? "Bullish" : defBias === "bearish" ? "Bearish" : "Neutral"} strategy aligned with your scenario`);
      bullets.push(`Max risk: ${lossStr} | Max gain: ${gainStr}`);
      if (beStr !== "N/A") bullets.push(`Breakeven at ${beStr}`);
  }

  return bullets.slice(0, 4);
}

function buildRisks(
  defId: string,
  bias: ScenarioBias,
  expiryDaysOut: number
): string[] {
  const shortDated = expiryDaysOut <= 21;

  const riskMap: Record<string, string[]> = {
    "long-call": [
      shortDated
        ? "Aggressive theta decay — loses value rapidly in final weeks"
        : "Theta decay accelerates as expiry approaches",
      "If stock is below the strike at expiry, you lose 100% of premium",
    ],
    "bull-call-spread": [
      "Upside is capped at the short strike — you won't benefit from a very large rally",
      "Both legs expire worthless if stock doesn't move above the long strike",
    ],
    "covered-call": [
      "Upside is capped if stock rallies sharply above the short strike",
      "Still fully exposed to stock downside (the underlying shares)",
    ],
    "long-put": [
      shortDated
        ? "Aggressive theta decay — put loses value rapidly if stock stays flat"
        : "Theta decay works against the position; stock must move before expiry",
      "If stock is above strike at expiry, 100% of premium is lost",
    ],
    "bear-put-spread": [
      "Max profit is capped at the spread width if stock falls sharply below the short put",
      "Both legs expire worthless if stock doesn't decline below the long put strike",
    ],
    "atm-straddle": [
      "IV crush risk: if implied volatility drops after earnings/event, position loses value",
      "Needs a large move to cover both premiums — flat stocks are costly",
    ],
    "atm-strangle": [
      "IV crush risk: requires a larger move than straddle to be profitable",
      "Both OTM options can expire worthless if stock moves modestly",
    ],
    butterfly: [
      "Max profit only achievable if stock lands exactly at the middle strike at expiry",
      "Low probability of achieving max gain; commissions eat into small positions",
    ],
  };

  return riskMap[defId] ?? [
    "Options can expire worthless if the expected move doesn't occur",
    "Time decay works against long premium positions",
  ];
}

// ---------------------------------------------------------------------------
// Main recommender function
// ---------------------------------------------------------------------------

/**
 * Recommend 3-5 strategy candidates for the given scenario.
 * Strategies are scored and ranked but none is labelled "best".
 */
export function recommendStrategies(
  scenario: Partial<Scenario>,
  chain: OptionChain,
  constraints: Constraints = {}
): RecommendedStrategy[] {
  const spot = chain.underlyingPrice;
  const bias = inferBias(scenario, spot);

  // Pick expiry closest to scenario target date
  const expiry = pickExpiry(chain.expirations, bias.daysOut);
  const expiryDaysOut = Math.round(
    (new Date(expiry).getTime() - Date.now()) / 86_400_000
  );

  const candidates: RecommendedStrategy[] = [];

  for (const def of STRATEGY_DEFS) {
    const strategy = buildStrategy(def.id, chain, expiry);
    if (!strategy) continue;

    const debitAmt = netDebit(strategy);
    const { maxGain, maxLoss } = computeMaxGainLoss(strategy.legs, spot);
    const breakevens = computeBreakevens(strategy.legs, spot);

    // Apply hard constraints
    if (constraints.maxDebitDollars !== undefined) {
      const absDebit = Math.abs(debitAmt);
      // Skip if debit exceeds 2× the budget (too far over)
      if (debitAmt < 0 && absDebit > constraints.maxDebitDollars * 2) continue;
    }
    if (constraints.preferDefinedRisk && maxLoss === null) continue;

    const fitScore = computeFitScore(
      def.id,
      def.bias,
      bias,
      maxGain,
      maxLoss,
      debitAmt,
      constraints
    );

    const rationale = buildRationale(
      def.id,
      def.bias,
      scenario,
      bias,
      debitAmt,
      maxGain,
      maxLoss,
      breakevens
    );

    const risks = buildRisks(def.id, bias, expiryDaysOut);

    const fit: RecommendedStrategy["fit"] = fitScore >= 55 ? "strong" : "moderate";

    candidates.push({
      id: `${def.id}-${expiry}`,
      strategy,
      netDebitCredit: debitAmt,
      maxGain,
      maxLoss,
      breakevens,
      rationale,
      risks,
      fit,
      fitScore,
    });
  }

  // Sort by fit score descending, cap at 5
  return candidates
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 5);
}
