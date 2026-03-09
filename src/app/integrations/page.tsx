import React from "react";
import { Cable, CheckCircle2, Clock, Lock, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Integration definitions
// ---------------------------------------------------------------------------

const INTEGRATIONS = [
  {
    name: "SnapTrade",
    logo: "📊",
    description:
      "Connect any supported brokerage via SnapTrade's universal OAuth flow. Read-only initially; multi-leg option order submission planned.",
    status: "planned" as const,
    features: [
      "OAuth 2.0 brokerage connection",
      "Read positions & balances",
      "Submit multi-leg option orders",
      "Real-time order status",
    ],
    oauthSteps: [
      "Click \u201cConnect Brokerage\u201d to open the SnapTrade OAuth window",
      "Log in to your brokerage and grant read permissions",
      "OptionSketch receives a secure token (no password stored)",
      "Select an account to use for order previews",
    ],
  },
  {
    name: "ConnectTrade",
    logo: "🔗",
    description:
      "API key–based connectivity for brokers that don't support OAuth. Paste your broker API key securely — it is encrypted at rest.",
    status: "planned" as const,
    features: [
      "API key-based auth (AES-256 encrypted)",
      "Options order execution",
      "Portfolio sync",
      "Risk management hooks",
    ],
    oauthSteps: [
      "Generate a read+trade API key in your brokerage dashboard",
      "Paste the key into OptionSketch (transmitted over TLS, stored encrypted)",
      "Select the account and paper/live trading mode",
      "Review order previews before any submission",
    ],
  },
  {
    name: "Live Market Data",
    logo: "📡",
    description:
      "Real-time OHLCV and options chain data to replace the current synthetic mock generator.",
    status: "planned" as const,
    features: [
      "Real-time OHLCV quotes (15-min delay or live)",
      "Live option chains with Greeks",
      "Historical IV data for back-testing",
      "Earnings calendar integration",
    ],
    oauthSteps: [],
  },
];

const STATUS_CONFIG = {
  live:    { label: "Live",    color: "text-bull",       icon: CheckCircle2 },
  beta:    { label: "Beta",    color: "text-amber-400",  icon: Clock        },
  planned: { label: "Planned", color: "text-slate-500",  icon: Clock        },
};

// ---------------------------------------------------------------------------
// How order preview works
// ---------------------------------------------------------------------------

const ORDER_FLOW_STEPS = [
  {
    step: "1",
    title: "Build your strategy",
    body: "Use the Builder to draw a scenario and generate a ranked list of strategy candidates.",
  },
  {
    step: "2",
    title: "Preview the order",
    body: "Click \u201cPreview order\u201d on any strategy card. OptionSketch generates the multi-leg option order JSON \u2014 no order is sent yet.",
  },
  {
    step: "3",
    title: "Review & confirm",
    body: "A full order ticket shows strikes, expiries, estimated debit/credit, and max risk. You review all details before clicking Submit.",
  },
  {
    step: "4",
    title: "Submit to broker",
    body: "The order is routed to your connected brokerage via the integration API. You receive a confirmation with order ID.",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cable className="h-6 w-6 text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-sm text-slate-400">
            Broker execution and market data connections
          </p>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-800/40 bg-amber-950/30 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="text-sm text-amber-200/80">
          <strong>Preview — not yet live.</strong> All integrations below are
          planned for future releases. No real orders can be placed today.
          OptionSketch currently uses fully synthetic mock data for educational
          purposes only.
        </div>
      </div>

      {/* Integration cards */}
      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => {
          const { label, color, icon: Icon } = STATUS_CONFIG[integration.status];
          return (
            <Card key={integration.name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>{integration.logo}</span>
                    <CardTitle className="text-base text-white">
                      {integration.name}
                    </CardTitle>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">{integration.description}</p>

                {/* Features */}
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {integration.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-surface-700" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* OAuth flow steps */}
                {integration.oauthSteps.length > 0 && (
                  <div className="rounded-lg border border-surface-700 bg-surface-900 p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-500" />
                      How the connection will work
                    </p>
                    <ol className="space-y-1.5">
                      {integration.oauthSteps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs text-slate-500">
                          <span className="mt-0.5 shrink-0 rounded-full bg-surface-800 px-1.5 text-[10px] text-slate-600">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <Button variant="outline" size="sm" disabled className="text-xs gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Connect — coming soon
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* How order preview works */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">How order preview works</h2>
        <div className="grid grid-cols-2 gap-3">
          {ORDER_FLOW_STEPS.map(({ step, title, body }) => (
            <div
              key={step}
              className="rounded-xl border border-surface-700 bg-surface-900 p-4 space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-400">
                  {step}
                </span>
                <p className="text-sm font-semibold text-white">{title}</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security note */}
      <div className="flex items-start gap-3 rounded-lg border border-surface-700 bg-surface-900 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/70" />
        <div className="space-y-1 text-xs text-slate-500">
          <p className="font-semibold text-slate-400">Security model (planned)</p>
          <p>
            OAuth tokens and API keys will be stored encrypted (AES-256) server-side.
            OptionSketch will never store your brokerage password. Order submission
            requires explicit user confirmation — no auto-trading.
          </p>
          <p className="text-slate-600">
            This page describes planned functionality. Nothing is implemented yet.
          </p>
        </div>
      </div>
    </div>
  );
}
