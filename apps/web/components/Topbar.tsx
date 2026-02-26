"use client";

import { useNetwork } from "@starknet-react/core";

import { Badge, type BadgeTone } from "@/components/Badge";
import { GlassCard } from "@/components/GlassCard";

type TopbarProps = {
  syncLabel: string;
  syncTone: BadgeTone;
  modeLabel: string;
  modeTone: BadgeTone;
};

export function Topbar({ syncLabel, syncTone, modeLabel, modeTone }: TopbarProps) {
  const { chain } = useNetwork();
  const networkLabel = chain?.name ?? "No root linked";

  return (
    <GlassCard as="header" className="sticky top-3 z-40" innerClassName="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Machine Garden</h1>
          <p className="text-sm text-slate-600">Plant signed seeds on Starknet, then tend threads onchain.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="cyan">Network · {networkLabel}</Badge>
          <Badge tone={syncTone}>Sync · {syncLabel}</Badge>
          <Badge tone={modeTone}>Mode · {modeLabel}</Badge>
        </div>
      </div>
    </GlassCard>
  );
}
