import type { Metadata } from "next";
import "./globals.css";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import UnderstandModal from "@/components/UnderstandModal";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "OptionSketch — Visual Options Builder",
  description:
    "Sketch your market outlook on a chart and discover option strategies that match. Educational tool only.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen flex-col overflow-hidden bg-surface-950 text-slate-100">
        {/* Persistent disclaimer at the very top */}
        <DisclaimerBanner />

        {/* One-time modal (shows on first visit) */}
        <UnderstandModal />

        {/* Site navigation */}
        <NavBar />

        {/* Page content fills remaining space */}
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
