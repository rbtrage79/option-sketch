import React from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GLOSSARY: { term: string; definition: string }[] = [
  {
    term: "Call Option",
    definition:
      "A contract that gives the buyer the right (but not obligation) to purchase 100 shares of the underlying stock at the strike price before expiration.",
  },
  {
    term: "Put Option",
    definition:
      "A contract giving the buyer the right to sell 100 shares at the strike price before expiration. Useful for hedging downside or speculating on a decline.",
  },
  {
    term: "Strike Price",
    definition:
      "The pre-agreed price at which the option can be exercised. Choosing the right strike relative to your price outlook is critical.",
  },
  {
    term: "Expiration Date",
    definition:
      "The date after which the option contract is void. Options lose value as expiration approaches (time decay / theta).",
  },
  {
    term: "Premium",
    definition:
      "The price paid to buy an option contract. Made up of intrinsic value (how far in-the-money) and extrinsic/time value.",
  },
  {
    term: "Implied Volatility (IV)",
    definition:
      "The market's expectation of how much the stock will move. Higher IV = more expensive options. IV crush can harm long-option positions after earnings.",
  },
  {
    term: "Delta (Δ)",
    definition:
      "Rate of change of the option price per $1 move in the underlying. A call with delta 0.5 gains ~$0.50 when the stock rises $1.",
  },
  {
    term: "Theta (Θ)",
    definition:
      "Time decay — how much value an option loses each day as expiration approaches. Sellers benefit from theta; buyers pay it.",
  },
  {
    term: "Gamma (Γ)",
    definition:
      "Rate of change of delta. High gamma means delta changes rapidly — options near-the-money close to expiration have the highest gamma.",
  },
  {
    term: "Vega (V)",
    definition:
      "Sensitivity to implied volatility. An option with vega 0.10 gains $0.10 for each 1% rise in IV.",
  },
  {
    term: "Covered Call",
    definition:
      "Owning 100 shares + selling 1 call. Generates income (premium) but caps upside at the strike price.",
  },
  {
    term: "Cash-Secured Put",
    definition:
      "Selling a put while holding enough cash to buy the shares if assigned. A way to acquire stock at a discount or earn premium.",
  },
  {
    term: "Vertical Spread",
    definition:
      "Buying one option and selling another with the same expiration but different strikes. Limits both risk and reward.",
  },
  {
    term: "Straddle",
    definition:
      "Buying a call and put at the same strike and expiration. Profits from large moves in either direction; expensive in high-IV environments.",
  },
  {
    term: "Breakeven",
    definition:
      "The stock price at which the trade neither gains nor loses money at expiration. For a long call: strike + premium paid.",
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Options Glossary</h1>
          <p className="text-sm text-slate-400">
            Key terms to understand before building strategies
          </p>
        </div>
      </div>

      {/* Stub notice */}
      <div className="mb-6 rounded-lg border border-brand-500/30 bg-brand-500/10 p-4 text-sm text-brand-100">
        <strong>Coming soon:</strong> interactive examples, payoff diagrams, and
        guided walkthroughs will be added here. For now, use this glossary as a
        quick reference.
      </div>

      {/* Glossary list */}
      <div className="space-y-3">
        {GLOSSARY.map(({ term, definition }) => (
          <Card key={term}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm text-brand-100">{term}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-300">
                {definition}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* External resources */}
      <div className="mt-8 rounded-lg border border-surface-700 bg-surface-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">
          Further reading
        </h2>
        <ul className="space-y-2 text-sm text-slate-400">
          <li className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            OCC (Options Clearing Corporation) — official educational resources
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            CBOE Options Institute — free courses
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            Investopedia Options Basics Guide
          </li>
        </ul>
      </div>
    </div>
  );
}
