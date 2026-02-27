import { blackScholes, normCDF, bsPrice, bsDelta } from "@/lib/blackScholes";

// ---------------------------------------------------------------------------
// normCDF tests
// ---------------------------------------------------------------------------
describe("normCDF", () => {
  it("returns 0.5 at x=0", () => {
    expect(normCDF(0)).toBeCloseTo(0.5, 4);
  });

  it("returns ~0.8413 at x=1", () => {
    expect(normCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it("returns ~0.9772 at x=2", () => {
    expect(normCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it("is symmetric: normCDF(-x) = 1 - normCDF(x)", () => {
    for (const x of [0.5, 1.0, 1.5, 2.0, 2.5]) {
      expect(normCDF(-x)).toBeCloseTo(1 - normCDF(x), 6);
    }
  });

  it("approaches 0 for very negative x", () => {
    expect(normCDF(-5)).toBeLessThan(0.0001);
  });

  it("approaches 1 for very positive x", () => {
    expect(normCDF(5)).toBeGreaterThan(0.9999);
  });
});

// ---------------------------------------------------------------------------
// Black-Scholes pricing tests
// ---------------------------------------------------------------------------
describe("blackScholes – call pricing", () => {
  // Classic BS test: S=100, K=100, T=1yr, r=5%, σ=20%
  // Expected call price ≈ 10.45 (well-known textbook value)
  it("prices ATM call correctly (S=K=100, T=1, r=0.05, σ=0.20)", () => {
    const { price } = blackScholes(100, 100, 1, 0.05, 0.20, "call");
    expect(price).toBeCloseTo(10.45, 1);
  });

  it("prices ATM put correctly (S=K=100, T=1, r=0.05, σ=0.20)", () => {
    const { price } = blackScholes(100, 100, 1, 0.05, 0.20, "put");
    // Put-call parity: P = C - S + K*e^(-rT)
    const callPrice = blackScholes(100, 100, 1, 0.05, 0.20, "call").price;
    const pcpExpected = callPrice - 100 + 100 * Math.exp(-0.05 * 1);
    expect(price).toBeCloseTo(pcpExpected, 3);
  });

  it("deep ITM call price ≈ S - K*e^(-rT)", () => {
    // Strike much lower than spot → almost certainly exercised
    const { price } = blackScholes(200, 50, 1, 0.05, 0.20, "call");
    const intrinsic = 200 - 50 * Math.exp(-0.05 * 1);
    expect(price).toBeCloseTo(intrinsic, 0);
  });

  it("deep OTM call price is near zero", () => {
    const { price } = blackScholes(100, 300, 0.5, 0.05, 0.20, "call");
    expect(price).toBeLessThan(0.01);
  });

  it("call price increases with vol", () => {
    const low = blackScholes(100, 100, 1, 0.05, 0.10, "call").price;
    const high = blackScholes(100, 100, 1, 0.05, 0.50, "call").price;
    expect(high).toBeGreaterThan(low);
  });

  it("call price decreases as strike increases (all else equal)", () => {
    const p1 = blackScholes(100, 90, 1, 0.05, 0.20, "call").price;
    const p2 = blackScholes(100, 100, 1, 0.05, 0.20, "call").price;
    const p3 = blackScholes(100, 110, 1, 0.05, 0.20, "call").price;
    expect(p1).toBeGreaterThan(p2);
    expect(p2).toBeGreaterThan(p3);
  });
});

// ---------------------------------------------------------------------------
// Put-call parity: C - P = S - K*e^(-rT)
// ---------------------------------------------------------------------------
describe("blackScholes – put-call parity", () => {
  const cases = [
    { S: 100, K: 95, T: 0.5, r: 0.03, sigma: 0.25 },
    { S: 450, K: 460, T: 0.25, r: 0.02, sigma: 0.18 },
    { S: 200, K: 200, T: 1, r: 0.05, sigma: 0.40 },
  ];

  for (const { S, K, T, r, sigma } of cases) {
    it(`parity holds for S=${S}, K=${K}, T=${T}, σ=${sigma}`, () => {
      const call = blackScholes(S, K, T, r, sigma, "call").price;
      const put = blackScholes(S, K, T, r, sigma, "put").price;
      const lhs = call - put;
      const rhs = S - K * Math.exp(-r * T);
      expect(lhs).toBeCloseTo(rhs, 2);
    });
  }
});

// ---------------------------------------------------------------------------
// Delta tests
// ---------------------------------------------------------------------------
describe("blackScholes – delta", () => {
  it("ATM call delta is close to 0.5", () => {
    const { delta } = blackScholes(100, 100, 1, 0.05, 0.20, "call");
    expect(delta).toBeGreaterThan(0.45);
    expect(delta).toBeLessThan(0.65);
  });

  it("deep ITM call delta approaches 1", () => {
    const { delta } = blackScholes(200, 50, 1, 0.05, 0.20, "call");
    expect(delta).toBeGreaterThan(0.99);
  });

  it("deep OTM call delta approaches 0", () => {
    const { delta } = blackScholes(100, 300, 1, 0.05, 0.20, "call");
    expect(delta).toBeLessThan(0.01);
  });

  it("put delta is in [-1, 0]", () => {
    for (const K of [80, 100, 120]) {
      const { delta } = blackScholes(100, K, 1, 0.05, 0.20, "put");
      expect(delta).toBeLessThanOrEqual(0);
      expect(delta).toBeGreaterThanOrEqual(-1);
    }
  });

  it("call delta − put delta = 1 (put-call delta parity)", () => {
    // BS: delta_call = N(d1),  delta_put = N(d1) − 1
    // ∴  delta_call − delta_put = 1  (put delta is negative, so subtraction adds them)
    const callDelta = blackScholes(100, 100, 1, 0.05, 0.20, "call").delta;
    const putDelta = blackScholes(100, 100, 1, 0.05, 0.20, "put").delta;
    expect(callDelta - putDelta).toBeCloseTo(1, 4);
    // put delta must be negative
    expect(putDelta).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// Greeks sign checks
// ---------------------------------------------------------------------------
describe("blackScholes – Greeks signs", () => {
  const base = blackScholes(100, 100, 1, 0.05, 0.20, "call");

  it("gamma is positive for long call", () => {
    expect(base.gamma).toBeGreaterThan(0);
  });

  it("theta is negative for long call (time decay)", () => {
    expect(base.theta).toBeLessThan(0);
  });

  it("vega is positive for long call", () => {
    expect(base.vega).toBeGreaterThan(0);
  });

  it("call price at T=0 equals intrinsic value", () => {
    const itm = blackScholes(110, 100, 1e-9, 0.05, 0.20, "call");
    expect(itm.price).toBeCloseTo(10, 0);
    const otm = blackScholes(90, 100, 1e-9, 0.05, 0.20, "call");
    expect(otm.price).toBeCloseTo(0, 2);
  });
});
