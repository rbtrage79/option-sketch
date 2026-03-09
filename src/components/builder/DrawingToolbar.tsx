"use client";

import React from "react";
import { Crosshair, GitBranch, MousePointer2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DrawingTool } from "@/lib/types";
import { useStore } from "@/lib/store";

interface Props {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
}

const TOOLS: {
  id: DrawingTool;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "none",
    label: "Select",
    icon: <MousePointer2 className="h-4 w-4" />,
    description: "Pan & zoom the chart",
  },
  {
    id: "targetPoint",
    label: "Target Point",
    icon: <Crosshair className="h-4 w-4" />,
    description: "Click a future date to set your price target",
  },
  {
    id: "path",
    label: "Path",
    icon: <GitBranch className="h-4 w-4" />,
    description: "Draw a multi-point price path into the future",
  },
];

export default function DrawingToolbar({ activeTool, onToolChange }: Props) {
  const { resetScenario } = useStore();

  return (
    <div className="flex items-center gap-1">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          title={tool.description}
          onClick={() => onToolChange(tool.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeTool === tool.id
              ? tool.id === "targetPoint"
                ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50"
                : tool.id === "path"
                ? "bg-brand-500/20 text-brand-100 ring-1 ring-brand-500/50"
                : "bg-surface-700 text-white ring-1 ring-surface-600"
              : "text-slate-400 hover:bg-surface-800 hover:text-slate-200"
          )}
        >
          {tool.icon}
          <span>{tool.label}</span>
        </button>
      ))}

      {/* Separator */}
      <div className="mx-1 h-5 w-px bg-surface-700" />

      {/* Reset drawing */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-slate-400 hover:text-red-400"
        onClick={() => {
          onToolChange("none");
          resetScenario();
        }}
        title="Clear all drawn annotations"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Clear
      </Button>
    </div>
  );
}
