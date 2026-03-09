/**
 * Monte Carlo simulation Web Worker
 *
 * Receives: { spot, r, vol, T, legs, numPaths }
 * Posts:    SimulationResult-shaped object
 *
 * Standalone — no imports. All required logic is inlined.
 * Model: Geometric Brownian Motion (lognormal terminal price distribution).
 */

// ---------------------------------------------------------------------------
// Normal random via Box-Muller transform
// ---------------------------------------------------------------------------
function normalRandom() {
  let u1, u2;
  do {
    u1 = Math.random();
  } while (u1 === 0); // avoid log(0)
  u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// ---------------------------------------------------------------------------
// Option payoff (mirrors payoff.ts logic, no imports)
// ---------------------------------------------------------------------------
function legPayoff(leg, spotAtExpiry) {
  var intrinsic =
    leg.type === "call"
      ? Math.max(0, spotAtExpiry - leg.strike)
      : Math.max(0, leg.strike - spotAtExpiry);
  var direction = leg.side === "long" ? 1 : -1;
  return direction * (intrinsic - leg.premium) * 100 * leg.qty;
}

function strategyPayoff(legs, spotAtExpiry) {
  if (!legs || legs.length === 0) return 0;
  var total = 0;
  for (var i = 0; i < legs.length; i++) {
    total += legPayoff(legs[i], spotAtExpiry);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Max gain / loss (theoretical, via payoff scan)
// ---------------------------------------------------------------------------
function computeMaxGainLoss(legs, spot) {
  if (!legs || legs.length === 0) return { maxGain: 0, maxLoss: 0 };

  var maxStrike = 0;
  for (var i = 0; i < legs.length; i++) {
    if (legs[i].strike > maxStrike) maxStrike = legs[i].strike;
  }
  var scanMax = 4 * maxStrike;
  var steps = 2000;

  var globalMin = Infinity;
  var globalMax = -Infinity;

  for (var j = 0; j <= steps; j++) {
    var s = (j / steps) * scanMax;
    var pnl = strategyPayoff(legs, s);
    if (pnl < globalMin) globalMin = pnl;
    if (pnl > globalMax) globalMax = pnl;
  }

  // Check edge for "unlimited" gain (payoff still rising at scan boundary)
  var edgeHigh = strategyPayoff(legs, scanMax);
  var nearHigh = strategyPayoff(legs, scanMax * 0.99);
  var isUnlimitedGain = Math.abs(edgeHigh - nearHigh) > 0.5 * (Math.abs(globalMax) / steps + 0.01);

  return {
    maxGain: isUnlimitedGain ? null : +globalMax.toFixed(2),
    maxLoss: +globalMin.toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// Breakeven detection (sign-change scan)
// ---------------------------------------------------------------------------
function computeBreakevens(legs) {
  if (!legs || legs.length === 0) return [];

  var maxStrike = 0;
  for (var i = 0; i < legs.length; i++) {
    if (legs[i].strike > maxStrike) maxStrike = legs[i].strike;
  }
  var scanMax = 3 * maxStrike;
  var steps = 4000;
  var breakevens = [];
  var prevPnl = strategyPayoff(legs, 0);

  for (var j = 1; j <= steps; j++) {
    var s = (j / steps) * scanMax;
    var pnl = strategyPayoff(legs, s);

    if (prevPnl * pnl < 0) {
      var prevS = ((j - 1) / steps) * scanMax;
      var be = prevS - prevPnl * ((s - prevS) / (pnl - prevPnl));
      if (breakevens.length === 0 || Math.abs(be - breakevens[breakevens.length - 1]) > 0.5) {
        breakevens.push(+be.toFixed(2));
      }
    }

    prevPnl = pnl;
  }

  return breakevens;
}

// ---------------------------------------------------------------------------
// Histogram builder
// ---------------------------------------------------------------------------
function buildHistogram(sortedValues, numBins) {
  var n = sortedValues.length;
  if (n === 0) return [];

  var lo = sortedValues[0];
  var hi = sortedValues[n - 1];

  // Add a small buffer so edge values fall into valid bins
  var range = hi - lo;
  if (range < 1) range = 1;
  var binWidth = range / numBins;

  var bins = [];
  for (var i = 0; i < numBins; i++) {
    bins.push({ x: +(lo + (i + 0.5) * binWidth).toFixed(2), count: 0 });
  }

  for (var j = 0; j < n; j++) {
    var idx = Math.min(
      numBins - 1,
      Math.floor((sortedValues[j] - lo) / binWidth)
    );
    if (idx >= 0) bins[idx].count++;
  }

  return bins;
}

// ---------------------------------------------------------------------------
// Main message handler
// ---------------------------------------------------------------------------
self.onmessage = function (e) {
  var data = e.data;
  var spot = data.spot;
  var r = data.r !== undefined ? data.r : 0.02;
  var vol = data.vol;
  var T = data.T;
  var legs = data.legs || [];
  var numPaths = data.numPaths || 20000;

  var startTime = Date.now();

  if (T <= 0) {
    self.postMessage({ error: "T must be > 0 (target date must be in the future)" });
    return;
  }

  // GBM parameters
  var drift = (r - 0.5 * vol * vol) * T;
  var diffusion = vol * Math.sqrt(T);

  // Simulate paths
  var pnls = new Float64Array(numPaths);
  var underlyingPrices = new Float64Array(numPaths);

  for (var i = 0; i < numPaths; i++) {
    var z = normalRandom();
    var sT = spot * Math.exp(drift + diffusion * z);
    underlyingPrices[i] = sT;
    pnls[i] = strategyPayoff(legs, sT);
  }

  // Sort pnls for percentile calculation
  var sortedPnls = Array.from(pnls).sort(function (a, b) {
    return a - b;
  });

  // Statistics
  var profitCount = 0;
  var sumPnl = 0;
  for (var j = 0; j < numPaths; j++) {
    if (sortedPnls[j] > 0) profitCount++;
    sumPnl += sortedPnls[j];
  }

  var pop = profitCount / numPaths;
  var ev = sumPnl / numPaths;

  var percentiles = {
    p5: sortedPnls[Math.floor(0.05 * (numPaths - 1))],
    p25: sortedPnls[Math.floor(0.25 * (numPaths - 1))],
    p50: sortedPnls[Math.floor(0.50 * (numPaths - 1))],
    p75: sortedPnls[Math.floor(0.75 * (numPaths - 1))],
    p95: sortedPnls[Math.floor(0.95 * (numPaths - 1))],
  };

  // Histogram (60 bins)
  var histogram = buildHistogram(sortedPnls, 60);

  // Max gain/loss and breakevens (deterministic, no simulation needed)
  var maxGainLoss = computeMaxGainLoss(legs, spot);
  var breakevens = computeBreakevens(legs);

  // Subsample underlying prices for UI chart (2 000 points is enough)
  var sampleSize = Math.min(2000, numPaths);
  var underlyingSample = [];
  var step = Math.floor(numPaths / sampleSize);
  for (var k = 0; k < sampleSize; k++) {
    underlyingSample.push(+underlyingPrices[k * step].toFixed(2));
  }

  var durationMs = Date.now() - startTime;

  self.postMessage({
    pop: pop,
    ev: ev,
    maxGain: maxGainLoss.maxGain,
    maxLoss: maxGainLoss.maxLoss,
    breakevens: breakevens,
    percentiles: percentiles,
    histogram: histogram,
    underlyingSample: underlyingSample,
    durationMs: durationMs,
  });
};
