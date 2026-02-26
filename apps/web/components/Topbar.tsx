"use client";

import { useAccount, useConnect, useDisconnect, useNetwork } from "@starknet-react/core";

import { Badge, type BadgeTone } from "@/components/Badge";
import { GlassCard } from "@/components/GlassCard";

type TopbarProps = {
  syncLabel: string;
  syncTone: BadgeTone;
  modeLabel: string;
  modeTone: BadgeTone;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Topbar({ syncLabel, syncTone, modeLabel, modeTone }: TopbarProps) {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { connectors, connect, pendingConnector, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();

  const availableConnectors = connectors.filter((item) => item.available());
  const primaryConnector = availableConnectors[0];
  const isBusy = isConnecting || isDisconnecting;
  const networkLabel = chain?.name ?? "No root linked";

  const connectLabel = (() => {
    if (isBusy) {
      if (isConnecting) {
        return `Connecting ${pendingConnector?.name ?? "wallet"}...`;
      }
      return "Disconnecting...";
    }

    if (isConnected && address) {
      return `Connected ${shortAddress(address)}`;
    }

    if (primaryConnector) {
      return `Connect ${primaryConnector.name}`;
    }

    return "Connect Wallet";
  })();

  return (
    <GlassCard as="header" className="sticky top-3 z-40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Machine Garden</h1>
          <p className="text-sm text-slate-600">Plant signed seeds on Starknet, then watch threads bloom.</p>
          {connectError && <p className="text-xs text-rose-700">Connect issue: {connectError.message}</p>}
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">Network · {networkLabel}</Badge>
            <Badge tone={syncTone}>Sync · {syncLabel}</Badge>
            <Badge tone={modeTone}>Mode · {modeLabel}</Badge>
          </div>

          <button
            type="button"
            className="garden-button garden-button-primary text-sm"
            onClick={() => {
              if (isConnected) {
                disconnect();
                return;
              }
              if (primaryConnector) {
                connect({ connector: primaryConnector });
              }
            }}
            disabled={isBusy || (!isConnected && !primaryConnector)}
          >
            {connectLabel}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
