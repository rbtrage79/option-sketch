"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

interface Props {
  histogram: { x: number; count: number }[];
  ev: number;
  breakevens?: number[];
  height?: number;
}

export default function DistributionChart({
  histogram,
  ev,
  breakevens = [],
  height = 180,
}: Props) {
  const option: EChartsOption = useMemo(() => {
    const categories = histogram.map((b) => b.x.toFixed(0));
    const counts = histogram.map((b) => ({
      value: b.count,
      itemStyle: {
        color: b.x >= 0 ? "rgba(38,166,154,0.75)" : "rgba(239,83,80,0.75)",
        borderColor: b.x >= 0 ? "#26a69a" : "#ef5350",
        borderWidth: 0,
      },
    }));

    // Find EV bin index for markLine
    const evIdx = histogram.reduce(
      (best, b, i) =>
        Math.abs(b.x - ev) < Math.abs(histogram[best].x - ev) ? i : best,
      0
    );

    // Breakeven markLines
    const beMarkLines = breakevens.slice(0, 3).map((be) => {
      const beIdx = histogram.reduce(
        (best, b, i) =>
          Math.abs(b.x - be) < Math.abs(histogram[best].x - be) ? i : best,
        0
      );
      return {
        name: `BE $${be.toFixed(0)}`,
        xAxis: String(histogram[beIdx]?.x.toFixed(0) ?? beIdx),
        lineStyle: { color: "#f59e0b", type: "dashed" as const, width: 1.5 },
        label: {
          show: true,
          color: "#f59e0b",
          fontSize: 9,
          formatter: () => `BE`,
          position: "end" as const,
        },
      };
    });

    return {
      animation: false,
      backgroundColor: "transparent",
      grid: { top: 12, bottom: 30, left: 44, right: 8 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        textStyle: { color: "#cbd5e1", fontSize: 11 },
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          if (!p) return "";
          return `P/L ~$${p.name}<br/>Paths: ${p.value.toLocaleString()}`;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "#334155" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 9,
          interval: Math.floor(histogram.length / 6),
          formatter: (v: string) => {
            const n = Number(v);
            if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}k`;
            return `$${n}`;
          },
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#1e293b", type: "dashed" } },
        axisLabel: { color: "#475569", fontSize: 9 },
      },
      series: [
        {
          type: "bar",
          data: counts,
          barWidth: "96%",
          markLine: {
            symbol: "none",
            silent: true,
            data: [
              // Zero line
              {
                name: "0",
                xAxis: "0",
                lineStyle: { color: "#64748b", type: "solid" as const, width: 1.5 },
                label: { show: false },
              },
              // EV line
              {
                name: `EV $${ev.toFixed(0)}`,
                xAxis: String(histogram[evIdx]?.x.toFixed(0) ?? evIdx),
                lineStyle: { color: "#6366f1", type: "dashed" as const, width: 1.5 },
                label: {
                  show: true,
                  color: "#a5b4fc",
                  fontSize: 9,
                  formatter: () => `EV`,
                  position: "start" as const,
                },
              },
              ...beMarkLines,
            ],
          },
        },
      ],
    };
  }, [histogram, ev, breakevens]);

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      notMerge
    />
  );
}
