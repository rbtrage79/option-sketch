// ---------------------------------------------------------------------------
// Heuristic natural-language scenario parser
//
// Parses free-text strings like:
//   "up 5% in 2 months"
//   "flat for 4 weeks"
//   "big move either way in 3 weeks"
//   "down 10% by end of March"
//   "bullish, targeting 480 by next month"
// ---------------------------------------------------------------------------

import type { ParseResult, CandidateBias } from "@/lib/types";

// ---------------------------------------------------------------------------
// Direction patterns
// ---------------------------------------------------------------------------

const UP_RE =
  /\b(up(?:ward)?|bull(?:ish)?|rises?|rising|rally(?:ing)?|higher|gains?|climbs?|long|calls?|positiv(?:e|ely)|go(?:es|ing)\s+up|move(?:s|d)?\s+up)\b/i;

const DOWN_RE =
  /\b(down(?:ward)?|bear(?:ish)?|falls?|falling|drops?|dropping|lower|decline[sd]?|declining|short|puts?|sell(?:\s*off)?|negativ(?:e|ely)|go(?:es|ing)\s+down|move(?:s|d)?\s+down|crash(?:es|ing)?)\b/i;

const NEUTRAL_RE =
  /\b(flat|sideways|side-?ways|neutral|range[-\s]?bound|stable|unchanged|consolidat(?:e[sd]?|ing)|chop(?:py)?|go(?:es|ing)\s+nowhere)\b/i;

const VOLATILE_RE =
  /\b(volatile|volatil(?:e|ity)|big\s+move|huge\s+move|large\s+move|breakout|breakdown|either\s+way|either\s+direction|swing(?:ing)?|explosion|explod(?:e|ing)|whipsaw)\b/i;

// ---------------------------------------------------------------------------
// Magnitude patterns
// ---------------------------------------------------------------------------

// Numeric: "5%", "5.5 percent"
const PCT_NUM_RE = /(\d+(?:\.\d+)?)\s*(?:%|percent)/i;

// Named magnitude words → approximate pct
const MAGNITUDE_MAP: [RegExp, number][] = [
  [/\b(tiny|negligible|very\s+small)\b/i, 1.5],
  [/\bsmall\b/i, 3],
  [/\bmodest\b/i, 4],
  [/\b(moderate|medium)\b/i, 5],
  [/\b(significant|meaningful)\b/i, 7],
  [/\b(big|large|major)\b/i, 8],
  [/\b(huge|very\s+big|very\s+large)\b/i, 12],
  [/\b(massive|enormous|gigantic|extreme)\b/i, 18],
];

// ---------------------------------------------------------------------------
// Timeframe patterns
// ---------------------------------------------------------------------------

const WEEKS_RE = /(\d+(?:\.\d+)?)\s*weeks?/i;
const MONTHS_RE = /(\d+(?:\.\d+)?)\s*months?/i;
const DAYS_RE = /(\d+)\s*(?:trading\s+)?days?/i;

// "by/before/around/at/in/end of <Month>" — handles optional "end of", "expiry"
const NAMED_MONTH_RE =
  /\b(?:by|before|around|at|in|end\s+of|through|until|before\s+end\s+of)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

const MONTH_IDX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

// Short qualitative timeframe hints
const SHORT_TERM_RE = /\b(this\s+week|next\s+week|soon|quickly|fast|shortly)\b/i;
const MEDIUM_TERM_RE = /\b(this\s+month|next\s+month|near[\s-]?term)\b/i;
const LONG_TERM_RE = /\b(longer[\s-]?term|over\s+the\s+next\s+(?:few|several)\s+months|by\s+year[\s-]?end)\b/i;

// Absolute price target: "targeting 480", "to $450", "hit 500"
const TARGET_PRICE_RE = /(?:target(?:ing)?|to|toward|up\s+to|hit(?:ting)?|reach(?:ing)?)\s+\$?(\d{2,5}(?:\.\d{1,2})?)/i;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function addCalendarDays(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(daysFromNow));
  return d.toISOString().slice(0, 10);
}

/** The 3rd Friday of a given month/year (standard US options expiry). */
function thirdFriday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  // advance to first Friday
  const dow = d.getDay(); // 0=Sun
  const daysToFri = (5 - dow + 7) % 7;
  d.setDate(1 + daysToFri + 14); // 3rd Friday
  return d;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseScenario(input: string): ParseResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  const parsedFields: ParseResult["parsedFields"] = [];
  let direction: CandidateBias | undefined;
  let magnitudePct: number | undefined;
  let targetDate: string | undefined;
  let targetPrice: number | undefined;
  let ambiguous = false;

  // ── 1. Direction ──────────────────────────────────────────────────────────

  const isUp = UP_RE.test(text);
  const isDown = DOWN_RE.test(text);
  const isNeutral = NEUTRAL_RE.test(text);
  const isVolatile = VOLATILE_RE.test(text);

  const hitCount = [isUp, isDown, isNeutral, isVolatile].filter(Boolean).length;

  if (hitCount === 1) {
    if (isUp) direction = "up";
    else if (isDown) direction = "down";
    else if (isNeutral) direction = "neutral";
    else direction = "volatile";
    parsedFields.push("direction");
  } else if (hitCount > 1) {
    // Resolve conflicts heuristically
    if (isVolatile && !isNeutral) {
      direction = "volatile";
    } else if (isUp && !isDown) {
      direction = "up";
    } else if (isDown && !isUp) {
      direction = "down";
    } else {
      direction = "neutral";
    }
    parsedFields.push("direction");
    ambiguous = true;
  }

  // ── 2. Magnitude ──────────────────────────────────────────────────────────

  const pctMatch = PCT_NUM_RE.exec(text);
  if (pctMatch) {
    magnitudePct = parseFloat(pctMatch[1]);
    parsedFields.push("magnitude");
  } else {
    for (const [re, pct] of MAGNITUDE_MAP) {
      if (re.test(lower)) {
        magnitudePct = pct;
        parsedFields.push("magnitude");
        break;
      }
    }
  }

  // ── 3. Timeframe ──────────────────────────────────────────────────────────

  const weeksMatch = WEEKS_RE.exec(text);
  const monthsMatch = MONTHS_RE.exec(text);
  const daysMatch = DAYS_RE.exec(text);

  if (weeksMatch) {
    targetDate = addCalendarDays(parseFloat(weeksMatch[1]) * 7);
    parsedFields.push("timeframe");
  } else if (monthsMatch) {
    targetDate = addCalendarDays(parseFloat(monthsMatch[1]) * 30.5);
    parsedFields.push("timeframe");
  } else if (daysMatch) {
    targetDate = addCalendarDays(parseInt(daysMatch[1], 10));
    parsedFields.push("timeframe");
  } else {
    const namedMatch = NAMED_MONTH_RE.exec(text);
    if (namedMatch) {
      const monthKey = namedMatch[1].toLowerCase().slice(0, 3);
      const monthNum = MONTH_IDX[monthKey] ?? MONTH_IDX[namedMatch[1].toLowerCase()];
      if (monthNum !== undefined) {
        const today = new Date();
        const year =
          today.getMonth() > monthNum
            ? today.getFullYear() + 1
            : today.getFullYear();
        const expiry = thirdFriday(year, monthNum);
        targetDate = expiry.toISOString().slice(0, 10);
        parsedFields.push("timeframe");
      }
    } else if (SHORT_TERM_RE.test(lower)) {
      targetDate = addCalendarDays(7);
      parsedFields.push("timeframe");
    } else if (MEDIUM_TERM_RE.test(lower)) {
      targetDate = addCalendarDays(30);
      parsedFields.push("timeframe");
    } else if (LONG_TERM_RE.test(lower)) {
      targetDate = addCalendarDays(90);
      parsedFields.push("timeframe");
    }
  }

  // ── 4. Absolute price target ──────────────────────────────────────────────

  const priceMatch = TARGET_PRICE_RE.exec(text);
  if (priceMatch) {
    targetPrice = parseFloat(priceMatch[1]);
  }

  // ── 5. Confidence & hint ──────────────────────────────────────────────────

  let confidence: ParseResult["confidence"];
  if (parsedFields.length >= 3) confidence = "high";
  else if (parsedFields.length === 2) confidence = "medium";
  else if (parsedFields.length === 1) confidence = "medium";
  else confidence = "low";

  // Downgrade if nothing meaningful was parsed
  if (!direction && !magnitudePct && !targetDate && !targetPrice) {
    ambiguous = true;
    confidence = "low";
  }

  let hint: string | undefined;
  if (!direction) {
    hint =
      "What direction do you expect — up, down, flat, or a big move either way?";
  } else if (!targetDate) {
    hint =
      "When do you expect this to happen? e.g. 'in 3 weeks' or 'by end of March'";
  } else if (!magnitudePct) {
    hint = "How large a move? e.g. '5%', 'big', or 'small'";
  }

  return {
    direction,
    magnitudePct,
    targetPrice,
    targetDate,
    ambiguous,
    confidence,
    parsedFields,
    hint,
  };
}
