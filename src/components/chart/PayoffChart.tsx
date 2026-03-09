"use client";

// ---------------------------------------------------------------------------
// PayoffChart — mini ECharts line chart showing P/L vs spot at expiry
// Used inside StrategyCard and CompareModal.
// ---------------------------------------------------------------------------

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { OptionLeg } from "@/lib/types";
import { strategyPayoffAtExpiry } from "@/lib/payoff";

interface PayoffChartProps {
  legs: OptionLeg[];
  spot: number;
  height?: number;
}

export default function PayoffChart({ legs, spot, height = 120 }: PayoffChartProps) {
  const { xData, yData } = useMemo(() => {
    if (legs.length === 0) return { xData: [], yData: [] };

    const lo = spot * 0.7;
    const hi = spot * 1.3;
    const steps = 80;
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const s = lo + (i / steps) * (hi - lo);
      xs.push(+s.toFixed(2));
      ys.push(+strategyPayoffAtExpiry(legs, s).toFixed(2));
    }

    return { xData: xs, yData: ys };
  }, [legs, spot]);

  const option = useMemo(() => {
    if (xData.length === 0) return {};

    // Split into gain (green) and loss (red) segments using piecewise visualMap
    return {
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 4, right: 4, top: 6, bottom: 22 },
      xAxis: {
        type: "category",
        data: xData,
        axisLabel: {
          show: true,
          fontSize: 9,
          color: "#64748b",
          interval: Math.floor(xData.length / 3),
          formatter: (v: number) => `$${v}`,
        },
        axisLine: { lineStyle: { color: "#1e293b" } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { show: false },
        axisLine: { show: false },
        splitLine: {
          lineStyle: { color: "#1e293b", type: "dashed" },
        },
      },
      visualMap: {
        show: false,
        type: "piecewise",
        dimension: 1,
        seriesIndex: 0,
        pieces: [
          { lt: 0, color: "#ef4444" },
          { gte: 0, color: "#22c55e" },
        ],
      },
      series: [
        {
          type: "line",
          data: yData,
          symbol: "none",
          lineStyle: { width: 1.5 },
          markLine: {
            silent: true,
            symbol: "none",
            data: [{ yAxis: 0, lineStyle: { color: "#334155", type: "dashed", width: 1 } }],
          },
        },
      ],
      tooltip: {
        trigger: "axis",
        backgroundColor: "#0f172a",
        borderColor: "#1e293b",
        textStyle: { color: "#e2e8f0", fontSize: 11 },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0].dataIndex;
          const x = xData[i];
          const y = yData[i];
          const sign = y >= 0 ? "+" : "";
          return `$${x}  →  ${sign}$${y.toFixed(0)}`;
        },
      },
    };
  }, [xData, yData]);

  if (legs.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-600"
      >
        No legs
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
    />
  );
}
