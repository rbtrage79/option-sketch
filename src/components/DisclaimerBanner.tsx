"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

export default function DisclaimerBanner() {
  return (
    <div className="flex items-center gap-3 bg-amber-950/60 px-4 py-2 text-xs text-amber-300 backdrop-blur-sm">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <p>
        <strong>Educational use only.</strong> OptionSketch does not constitute
        financial, investment, or trading advice. Options trading involves
        substantial risk of loss. Past performance is not indicative of future
        results. Always consult a licensed financial advisor before trading.
      </p>
    </div>
  );
}
