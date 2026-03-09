import {
  legPayoffAtExpiry,
  strategyPayoffAtExpiry,
  computeMaxGainLoss,
  computeBreakevens,
} from "@/lib/payoff";
import type { OptionLeg } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function longCall(strike: number, premium: number, qty = 1): OptionLeg {
  return { type: "call", side: "long", strike, premium, expiry: "2025-01-01", qty };
}
function shortCall(strike: number, premium: number, qty = 1): OptionLeg {
  return { type: "call", side: "short", strike, premium, expiry: "2025-01-01", qty };
}
function longPut(strike: number, premium: number, qty = 1): OptionLeg {
  return { type: "put", side: "long", strike, premium, expiry: "2025-01-01", qty };
}
function shortPut(strike: number, premium: number, qty = 1): OptionLeg {
  return { type: "put", side: "short", strike, premium, expiry: "2025-01-01", qty };
}

// ---------------------------------------------------------------------------
// Single leg payoff
// ---------------------------------------------------------------------------
describe("legPayoffAtExpiry – long call", () => {
  const leg = longCall(100, 5); // bought for $5 premium (1 contract = $500 total)

  it("expires worthless (spot < strike)", () => {
    // Intrinsic = 0; loss = premium × 100
    expect(legPayoffAtExpiry(leg, 95)).toBeCloseTo(-500);
  });

  it("at-expiry exactly at strike (spot = strike)", () => {
    // Intrinsic = 0; total loss = premium
    expect(legPayoffAtExpiry(leg, 100)).toBeCloseTo(-500);
  });

  it("at breakeven (spot = strike + premium)", () => {
    expect(legPayoffAtExpiry(leg, 105)).toBeCloseTo(0);
  });

  it("in the money (spot = 120)", () => {
    // Intrinsic = 20; P/L = (20 - 5) × 100 = +1500
    expect(legPayoffAtExpiry(leg, 120)).toBeCloseTo(1500);
  });

  it("scales linearly above strike", () => {
    const p1 = legPayoffAtExpiry(leg, 110);
    const p2 = legPayoffAtExpiry(leg, 120);
    expect(p2 - p1).toBeCloseTo(1000); // $10 more × 100 shares
  });
});

describe("legPayoffAtExpiry – long put", () => {
  const leg = longPut(100, 4); // bought for $4

  it("expires worthless (spot > strike)", () => {
    expect(legPayoffAtExpiry(leg, 110)).toBeCloseTo(-400);
  });

  it("at breakeven (spot = strike - premium)", () => {
    expect(legPayoffAtExpiry(leg, 96)).toBeCloseTo(0);
  });

  it("in the money (spot = 80)", () => {
    // Intrinsic = 20; P/L = (20 - 4) × 100 = +1600
    expect(legPayoffAtExpiry(leg, 80)).toBeCloseTo(1600);
  });

  it("maximum gain at spot = 0", () => {
    // Intrinsic = 100; P/L = (100 - 4) × 100 = +9600
    expect(legPayoffAtExpiry(leg, 0)).toBeCloseTo(9600);
  });
});

describe("legPayoffAtExpiry – short call", () => {
  const leg = shortCall(100, 5);

  it("call expires worthless → keep full premium", () => {
    expect(legPayoffAtExpiry(leg, 90)).toBeCloseTo(500);
  });

  it("at breakeven (spot = strike + premium)", () => {
    expect(legPayoffAtExpiry(leg, 105)).toBeCloseTo(0);
  });

  it("loses money when spot rises above breakeven", () => {
    expect(legPayoffAtExpiry(leg, 120)).toBeCloseTo(-1500);
  });
});

describe("legPayoffAtExpiry – short put", () => {
  const leg = shortPut(100, 4);

  it("put expires worthless → keep full premium", () => {
    expect(legPayoffAtExpiry(leg, 110)).toBeCloseTo(400);
  });

  it("loses money when spot falls below breakeven", () => {
    // BE = 100 - 4 = 96; spot = 80 → P/L = -(20-4)×100 = -1600
    expect(legPayoffAtExpiry(leg, 80)).toBeCloseTo(-1600);
  });
});

describe("legPayoffAtExpiry – multiple contracts", () => {
  it("2 contracts doubles the P/L", () => {
    const single = legPayoffAtExpiry(longCall(100, 5, 1), 120);
    const double = legPayoffAtExpiry(longCall(100, 5, 2), 120);
    expect(double).toBeCloseTo(2 * single);
  });
});

// ---------------------------------------------------------------------------
// Multi-leg strategy payoff
// ---------------------------------------------------------------------------
describe("strategyPayoffAtExpiry – bull call spread (100/110, net debit $3)", () => {
  // Buy 100-strike call for $5, sell 110-strike call for $2 → net debit $3
  const legs = [longCall(100, 5), shortCall(110, 2)];

  it("below lower strike: max loss = net debit × 100", () => {
    // Both calls expire worthless; P/L = -5×100 + 2×100 = -300
    expect(strategyPayoffAtExpiry(legs, 95)).toBeCloseTo(-300);
  });

  it("at breakeven: spot ≈ lower strike + net debit", () => {
    expect(strategyPayoffAtExpiry(legs, 103)).toBeCloseTo(0, 0);
  });

  it("between strikes: partial profit", () => {
    // At spot=105: long call intrinsic=5, short call=0; P/L=(5-5)*100+2*100=200
    expect(strategyPayoffAtExpiry(legs, 105)).toBeCloseTo(200);
  });

  it("above upper strike: max profit = (spread - net debit) × 100", () => {
    // At spot=115: long=15, short=−5; net intrinsic=10; P/L=(10-3)*100=700
    expect(strategyPayoffAtExpiry(legs, 115)).toBeCloseTo(700);
  });

  it("max profit is capped even at very high spot", () => {
    const p1 = strategyPayoffAtExpiry(legs, 200);
    const p2 = strategyPayoffAtExpiry(legs, 500);
    expect(p1).toBeCloseTo(p2);
  });
});

describe("strategyPayoffAtExpiry – straddle", () => {
  // Buy call and put both at 100-strike for $5 each → net debit $10
  const legs = [longCall(100, 5), longPut(100, 5)];

  it("at the strike: both expire worthless → max loss", () => {
    // P/L = -5*100 - 5*100 = -1000
    expect(strategyPayoffAtExpiry(legs, 100)).toBeCloseTo(-1000);
  });

  it("profits when spot moves far above strike", () => {
    expect(strategyPayoffAtExpiry(legs, 130)).toBeGreaterThan(0);
  });

  it("profits when spot moves far below strike", () => {
    expect(strategyPayoffAtExpiry(legs, 70)).toBeGreaterThan(0);
  });

  it("has two breakeven points (symmetric around 100)", () => {
    const be = computeBreakevens(legs, 100);
    expect(be.length).toBe(2);
    // BEs should be equidistant from 100
    const [low, high] = be;
    expect(100 - low).toBeCloseTo(high - 100, 0);
  });
});

describe("strategyPayoffAtExpiry – empty legs", () => {
  it("returns 0 for any spot", () => {
    expect(strategyPayoffAtExpiry([], 100)).toBe(0);
    expect(strategyPayoffAtExpiry([], 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeMaxGainLoss
// ---------------------------------------------------------------------------
describe("computeMaxGainLoss – long call", () => {
  const legs = [longCall(100, 5)];

  it("max loss equals premium paid", () => {
    const { maxLoss } = computeMaxGainLoss(legs, 100);
    expect(maxLoss).toBeCloseTo(-500, 0);
  });

  it("max gain is null (unlimited)", () => {
    const { maxGain } = computeMaxGainLoss(legs, 100);
    expect(maxGain).toBeNull();
  });
});

describe("computeMaxGainLoss – bull call spread", () => {
  // Buy 100 call for $5, sell 110 call for $2 → net debit $3
  const legs = [longCall(100, 5), shortCall(110, 2)];

  it("max loss is bounded (net debit)", () => {
    const { maxLoss } = computeMaxGainLoss(legs, 100);
    expect(maxLoss).not.toBeNull();
    expect(maxLoss!).toBeCloseTo(-300, 0);
  });

  it("max gain is bounded (spread width - net debit)", () => {
    const { maxGain } = computeMaxGainLoss(legs, 100);
    expect(maxGain).not.toBeNull();
    expect(maxGain!).toBeCloseTo(700, 0);
  });
});

describe("computeMaxGainLoss – long put", () => {
  const legs = [longPut(100, 4)];

  it("max loss equals premium paid", () => {
    const { maxLoss } = computeMaxGainLoss(legs, 100);
    expect(maxLoss).toBeCloseTo(-400, 0);
  });

  it("max gain is bounded at strike (spot cannot go below 0)", () => {
    const { maxGain } = computeMaxGainLoss(legs, 100);
    expect(maxGain).not.toBeNull();
    expect(maxGain!).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeBreakevens
// ---------------------------------------------------------------------------
describe("computeBreakevens – long call", () => {
  it("single breakeven = strike + premium", () => {
    const legs = [longCall(100, 5)];
    const be = computeBreakevens(legs, 100);
    expect(be.length).toBe(1);
    expect(be[0]).toBeCloseTo(105, 0);
  });
});

describe("computeBreakevens – long put", () => {
  it("single breakeven = strike - premium", () => {
    const legs = [longPut(100, 4)];
    const be = computeBreakevens(legs, 100);
    expect(be.length).toBe(1);
    expect(be[0]).toBeCloseTo(96, 0);
  });
});

describe("computeBreakevens – call spread", () => {
  it("single breakeven = lower strike + net debit", () => {
    const legs = [longCall(100, 5), shortCall(110, 2)];
    const be = computeBreakevens(legs, 100);
    expect(be.length).toBe(1);
    expect(be[0]).toBeCloseTo(103, 0);
  });
});

describe("computeBreakevens – empty legs", () => {
  it("returns empty array", () => {
    expect(computeBreakevens([], 100)).toHaveLength(0);
  });
});
