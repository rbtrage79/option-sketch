// ---------------------------------------------------------------------------
// Black-Scholes European option pricing
//
// Assumptions: European exercise, no dividends, constant vol & r.
// Accuracy: normal CDF via Abramowitz & Stegun (1964) – |error| < 7.5e-8
// ---------------------------------------------------------------------------

/**
 * Standard normal CDF using the Abramowitz & Stegun rational approximation.
 * Accurate to |ε| < 7.5e-8.
 */
export function normCDF(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const k = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const poly = k * (a1 + k * (a2 + k * (a3 + k * (a4 + k * a5))));
  const phi = 1.0 - (1.0 / Math.sqrt(2.0 * Math.PI)) * Math.exp(-0.5 * x * x) * poly;
  return x >= 0 ? phi : 1.0 - phi;
}

/** Standard normal PDF. */
export function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

// ---------------------------------------------------------------------------
// Core result interface
// ---------------------------------------------------------------------------

export interface BSResult {
  price: number;
  delta: number;
  /** Rate of change of delta per $1 move in underlying. */
  gamma: number;
  /** P/L per calendar day of time decay (negative for long options). */
  theta: number;
  /** P/L per +1 percentage-point move in IV. */
  vega: number;
}

// ---------------------------------------------------------------------------
// Compute d1, d2 helpers (exported for tests)
// ---------------------------------------------------------------------------

export function bsD1(S: number, K: number, T: number, r: number, sigma: number): number {
  return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

export function bsD2(S: number, K: number, T: number, r: number, sigma: number): number {
  return bsD1(S, K, T, r, sigma) - sigma * Math.sqrt(T);
}

// ---------------------------------------------------------------------------
// Black-Scholes pricer
// ---------------------------------------------------------------------------

/**
 * Price a European vanilla option and compute first-order Greeks.
 *
 * @param S     Current underlying price
 * @param K     Strike price
 * @param T     Time to expiry in years (use ≥ 1e-6)
 * @param r     Continuously-compounded risk-free rate (e.g. 0.02)
 * @param sigma Annualised implied volatility (e.g. 0.25)
 * @param type  "call" or "put"
 */
export function blackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): BSResult {
  // At expiry (or very close) return intrinsic value
  if (T <= 1e-6) {
    const intrinsic = type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
    const delta = intrinsic > 0 ? (type === "call" ? 1 : -1) : 0;
    return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = bsD1(S, K, T, r, sigma);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = normCDF(d1);
  const Nd2 = normCDF(d2);
  const nD1 = normPDF(d1); // standard normal PDF at d1

  const df = Math.exp(-r * T); // discount factor

  let price: number;
  let delta: number;

  if (type === "call") {
    price = S * Nd1 - K * df * Nd2;
    delta = Nd1;
  } else {
    price = K * df * normCDF(-d2) - S * normCDF(-d1);
    delta = Nd1 - 1.0;
  }

  // Greeks (same for call and put except signs already handled)
  const gamma = nD1 / (S * sigma * sqrtT);

  // Theta: per calendar day (divide annual theta by 365)
  const thetaAnnual =
    type === "call"
      ? -(S * nD1 * sigma) / (2 * sqrtT) - r * K * df * Nd2
      : -(S * nD1 * sigma) / (2 * sqrtT) + r * K * df * normCDF(-d2);
  const theta = thetaAnnual / 365.0;

  // Vega: per +1 percentage-point move in vol (multiply by 0.01)
  const vega = S * sqrtT * nD1 * 0.01;

  return {
    price: Math.max(0, price),
    delta: +delta.toFixed(6),
    gamma: +gamma.toFixed(8),
    theta: +theta.toFixed(6),
    vega: +vega.toFixed(6),
  };
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

export function bsPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): number {
  return blackScholes(S, K, T, r, sigma, type).price;
}

export function bsDelta(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): number {
  return blackScholes(S, K, T, r, sigma, type).delta;
}
