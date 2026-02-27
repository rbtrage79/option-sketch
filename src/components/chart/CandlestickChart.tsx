"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactECharts from "echarts-for-react";
import type { ECharts, EChartsOption } from "echarts";
import { generateFutureDates, generateMockBars } from "@/lib/mockData";
import { useStore } from "@/lib/store";
import type { DrawingTool, PathPoint } from "@/lib/types";
import { formatDate, formatPrice } from "@/lib/utils";

// ──────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  symbol: string;
  drawingTool: DrawingTool;
  onToolDone?: () => void;
}

function isoFromIndex(allDates: string[], idx: number): string | null {
  const i = Math.round(idx);
  if (i < 0 || i >= allDates.length) return null;
  return allDates[i];
}

// ──────────────────────────────────────────────────────────────────────────────
// Chart component
// ──────────────────────────────────────────────────────────────────────────────

export default function CandlestickChart({ symbol, drawingTool, onToolDone }: Props) {
  const chartRef = useRef<ReactECharts>(null);
  const { scenario, updateScenario } = useStore();

  // In-progress path while drawing (before committed to store)
  const [draftPath, setDraftPath] = useState<PathPoint[]>([]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { bars, histDates, allDates, histCount } = useMemo(() => {
    const bars = generateMockBars(symbol);
    const histDates = bars.map((b) =>
      new Date(b.time * 1000).toISOString().slice(0, 10)
    );
    const lastDate = new Date(bars[bars.length - 1].time * 1000);
    const futureDates = generateFutureDates(lastDate, 65);
    return {
      bars,
      histDates,
      allDates: [...histDates, ...futureDates],
      histCount: bars.length,
    };
  }, [symbol]);

  const candlestickData = useMemo(
    () => [
      ...bars.map((b) => [b.open, b.close, b.low, b.high]),
      ...Array(allDates.length - histCount).fill("-"),
    ],
    [bars, allDates, histCount]
  );

  const volumeData = useMemo(
    () => [
      ...bars.map((b) => b.volume),
      ...Array(allDates.length - histCount).fill("-"),
    ],
    [bars, allDates, histCount]
  );

  // Colors for volume bars (green if up, red if down)
  const volumeColors = useMemo(
    () =>
      bars.map((b) =>
        b.close >= b.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)"
      ),
    [bars]
  );

  // ── Derived overlay series for drawing ────────────────────────────────────

  /** Convert a date ISO → x-axis category index (may be fractional). */
  const dateToIndex = useCallback(
    (dateISO: string) => allDates.indexOf(dateISO),
    [allDates]
  );

  /** Build extra series from current scenario/draftPath for overlays. */
  const overlaySeries = useMemo(() => {
    const series: EChartsOption["series"] = [];

    // ── Target point ────────────────────────────────────────────────────────
    if (
      scenario.targetDate &&
      scenario.targetPrice !== undefined &&
      scenario.kind === "pointTarget"
    ) {
      const xi = dateToIndex(scenario.targetDate);
      if (xi !== -1) {
        series.push({
          type: "scatter" as const,
          name: "target",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: [[xi, scenario.targetPrice]],
          symbolSize: 18,
          itemStyle: { color: "#f59e0b" },
          label: {
            show: true,
            position: "top" as const,
            color: "#f59e0b",
            fontSize: 11,
            formatter: () => formatPrice(scenario.targetPrice!),
          },
          tooltip: { show: false },
          z: 10,
        });
      }
    }

    // ── Path (committed) ────────────────────────────────────────────────────
    const pts = scenario.kind === "path" ? (scenario.pathPoints ?? []) : [];
    if (pts.length >= 1) {
      // Connect last historical candle → first path point → rest of path
      const lastHistISO = histDates[histDates.length - 1];
      const lastClose = bars[bars.length - 1].close;
      const anchor = { dateISO: lastHistISO, price: lastClose };
      const fullPath = [anchor, ...pts];

      series.push({
        type: "line" as const,
        name: "path",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: fullPath.map((p) => [dateToIndex(p.dateISO), p.price]),
        lineStyle: { color: "#6366f1", width: 2, type: "dashed" as const },
        itemStyle: { color: "#6366f1" },
        symbolSize: 8,
        smooth: false,
        tooltip: { show: false },
        z: 9,
      });
    }

    // ── Draft path (while drawing, not yet committed) ────────────────────────
    if (draftPath.length >= 1) {
      const lastHistISO = histDates[histDates.length - 1];
      const lastClose = bars[bars.length - 1].close;
      const anchor = { dateISO: lastHistISO, price: lastClose };
      const fullDraft = [anchor, ...draftPath];

      series.push({
        type: "line" as const,
        name: "draftPath",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: fullDraft.map((p) => [dateToIndex(p.dateISO), p.price]),
        lineStyle: { color: "#a5b4fc", width: 2, type: "dotted" as const },
        itemStyle: { color: "#a5b4fc" },
        symbolSize: 6,
        smooth: false,
        tooltip: { show: false },
        z: 8,
      });
    }

    return series;
  }, [scenario, draftPath, dateToIndex, histDates, bars]);

  // ── Chart option ──────────────────────────────────────────────────────────

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      backgroundColor: "#0b1120",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        textStyle: { color: "#cbd5e1" },
        formatter: (params: unknown) => {
          const p = params as Array<{ dataIndex: number; value: unknown; seriesType?: string }>;
          const bar = p.find((s) => s.seriesType === "candlestick");
          if (!bar) return "";
          const v = bar.value as number[];
          const date = allDates[bar.dataIndex] ?? "";
          return [
            `<b>${date}</b>`,
            `O: ${v[1]?.toFixed(2)}  H: ${v[3]?.toFixed(2)}`,
            `L: ${v[2]?.toFixed(2)}  C: ${v[0]?.toFixed(2)}`,
          ].join("<br/>");
        },
      },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [
        { left: 70, right: 16, top: 12, height: "62%" },
        { left: 70, right: 16, bottom: 36, height: "18%" },
      ],
      xAxis: [
        {
          type: "category",
          data: allDates,
          boundaryGap: true,
          gridIndex: 0,
          axisLine: { lineStyle: { color: "#334155" } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: "#64748b",
            fontSize: 10,
            formatter: (val: string) => {
              const d = new Date(val);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            },
            // Show fewer labels to avoid crowding
            interval: Math.floor(allDates.length / 10),
          },
          // Mark the "today" divider visually
          markLine: undefined,
        },
        {
          type: "category",
          data: allDates,
          boundaryGap: true,
          gridIndex: 1,
          axisLine: { lineStyle: { color: "#334155" } },
          axisTick: { show: false },
          axisLabel: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          scale: true,
          gridIndex: 0,
          axisLine: { lineStyle: { color: "#334155" } },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#1e293b", type: "dashed" } },
          axisLabel: { color: "#64748b", fontSize: 10 },
          position: "left",
        },
        {
          scale: true,
          gridIndex: 1,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          splitNumber: 2,
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
          minValueSpan: 10,
        },
      ],
      // "Today" divider line via markArea on candlestick series
      series: [
        {
          type: "candlestick",
          name: "OHLC",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: candlestickData,
          itemStyle: {
            color: "#26a69a",
            color0: "#ef5350",
            borderColor: "#26a69a",
            borderColor0: "#ef5350",
          },
          markArea: {
            silent: true,
            data: [
              [
                { xAxis: histCount - 1 },
                { xAxis: allDates.length - 1 },
              ],
            ],
            itemStyle: { color: "rgba(99,102,241,0.04)" },
          },
        },
        {
          type: "bar",
          name: "Volume",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumeData.map((v, i) => ({
            value: v,
            itemStyle: { color: volumeColors[i] ?? "rgba(100,116,139,0.4)" },
          })),
          barMaxWidth: "80%",
        },
        ...(overlaySeries as object[]),
      ],
    }),
    [allDates, candlestickData, volumeData, volumeColors, overlaySeries, histCount]
  );

  // ── Click handler (via ZRender) ───────────────────────────────────────────

  const handleChartClick = useCallback(
    (offsetX: number, offsetY: number) => {
      if (drawingTool === "none") return;

      const chart = chartRef.current?.getEchartsInstance();
      if (!chart) return;

      // Only handle clicks within price grid (gridIndex 0)
      if (!chart.containPixel({ gridIndex: 0 }, [offsetX, offsetY])) return;

      // Convert pixel → data coordinates
      const [xIdx, price] = chart.convertFromPixel(
        { gridIndex: 0 },
        [offsetX, offsetY]
      ) as [number, number];

      const dateISO = isoFromIndex(allDates, xIdx);
      if (!dateISO || price == null || price <= 0) return;

      // Only allow clicks in the FUTURE area (after histCount - 1)
      const dataIdx = Math.round(xIdx);
      if (dataIdx < histCount) return;

      if (drawingTool === "targetPoint") {
        updateScenario({
          kind: "pointTarget",
          symbol,
          targetDate: dateISO,
          targetPrice: +price.toFixed(2),
        });
        // Auto-switch tool off after placing the target
        if (onToolDone) onToolDone();
      } else if (drawingTool === "path") {
        setDraftPath((prev) => [
          ...prev,
          { dateISO, price: +price.toFixed(2) },
        ]);
      }
    },
    [drawingTool, allDates, histCount, symbol, updateScenario, onToolDone]
  );

  // ── Commit draft path when user switches away from "path" tool ────────────
  useEffect(() => {
    if (drawingTool !== "path" && draftPath.length >= 2) {
      const last = draftPath[draftPath.length - 1];
      updateScenario({
        kind: "path",
        symbol,
        targetDate: last.dateISO,
        pathPoints: draftPath,
      });
      setDraftPath([]);
    } else if (drawingTool !== "path" && draftPath.length > 0) {
      // Less than 2 points: discard
      setDraftPath([]);
    }
  }, [drawingTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset draft when symbol changes ──────────────────────────────────────
  useEffect(() => {
    setDraftPath([]);
  }, [symbol]);

  // ── Attach ZRender click listener ─────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance();
    if (!chart) return;

    // Use ZRender for raw canvas clicks (works in empty future space too)
    const zr = (chart as ECharts & { getZr: () => { on: (ev: string, fn: (e: { offsetX: number; offsetY: number }) => void) => void; off: (ev: string, fn: unknown) => void } }).getZr();

    const onClick = (e: { offsetX: number; offsetY: number }) => {
      handleChartClick(e.offsetX, e.offsetY);
    };

    zr.on("click", onClick);
    return () => {
      zr.off("click", onClick);
    };
  }, [handleChartClick]);

  // ── Cursor style based on active tool ─────────────────────────────────────
  const cursor =
    drawingTool === "none"
      ? "default"
      : drawingTool === "targetPoint"
      ? "crosshair"
      : "cell";

  return (
    <div className="relative h-full w-full" style={{ cursor }}>
      {/* Future-zone label */}
      <div className="absolute right-20 top-3 z-10 rounded bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-brand-500">
        Future projection zone →
      </div>

      {/* Path drawing hint */}
      {drawingTool === "path" && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded bg-indigo-950/80 px-3 py-1 text-xs text-indigo-300 backdrop-blur-sm">
          {draftPath.length === 0
            ? "Click in the future zone to start your path"
            : `${draftPath.length} point${draftPath.length > 1 ? "s" : ""} — keep clicking, then switch tool or click Done`}
        </div>
      )}

      {drawingTool === "targetPoint" && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded bg-amber-950/80 px-3 py-1 text-xs text-amber-300 backdrop-blur-sm">
          Click a future date/price to set your target
        </div>
      )}

      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: "100%", width: "100%" }}
        notMerge={false}
        lazyUpdate={false}
      />
    </div>
  );
}
