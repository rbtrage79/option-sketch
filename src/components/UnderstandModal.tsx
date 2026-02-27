"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "option-sketch:disclaimer-accepted";

export default function UnderstandModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't accepted before
    if (typeof window !== "undefined") {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) setOpen(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        // Prevent closing by clicking outside or pressing Escape
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md"
      >
        <DialogHeader>
          <div className="mb-3 flex justify-center">
            <ShieldCheck className="h-10 w-10 text-brand-500" />
          </div>
          <DialogTitle className="text-center">Important Disclaimer</DialogTitle>
          <DialogDescription className="text-center">
            Please read before using OptionSketch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-slate-300">
          <p>
            <strong className="text-white">OptionSketch is for educational purposes only.</strong>{" "}
            Nothing on this platform constitutes financial, investment, or
            trading advice.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-400">
            <li>Options trading involves significant risk of loss.</li>
            <li>You may lose more than your initial investment.</li>
            <li>Past performance is not indicative of future results.</li>
            <li>All data shown is simulated and for demonstration only.</li>
          </ul>
          <p className="text-slate-400">
            Always consult a licensed financial advisor or broker before making
            investment decisions.
          </p>
        </div>

        <Button className="mt-4 w-full" onClick={handleAccept}>
          I understand — let me explore
        </Button>
      </DialogContent>
    </Dialog>
  );
}
