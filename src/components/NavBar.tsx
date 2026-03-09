"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BarChart2 } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/builder", label: "Builder" },
  { href: "/learn", label: "Learn" },
  { href: "/integrations", label: "Integrations" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="flex h-12 items-center gap-6 border-b border-surface-800 bg-surface-900 px-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-semibold text-white">
        <BarChart2 className="h-5 w-5 text-brand-500" />
        <span>OptionSketch</span>
        <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
          beta
        </span>
      </Link>

      {/* Navigation links */}
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              pathname === link.href
                ? "bg-surface-800 text-white"
                : "text-slate-400 hover:bg-surface-800 hover:text-slate-200"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
