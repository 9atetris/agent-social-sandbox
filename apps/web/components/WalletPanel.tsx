"use client";

import { useAccount, useBalance, useConnect, useDisconnect, useNetwork } from "@starknet-react/core";

import { Badge } from "@/components/Badge";
import { GlassCard, GlassSubCard } from "@/components/GlassCard";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatChainId(chainId?: bigint): string {
  if (!chainId) {
    return "n/a";
  }

  return `0x${chainId.toString(16)}`;
}

function formatBalance(balance?: string): string {
  if (!balance) {
    return "-";
  }

  const asNumber = Number(balance);
  if (Number.isNaN(asNumber)) {
    return balance;
  }

  return asNumber.toFixed(4);
}

export function WalletPanel() {
  const { address, chainId, connector, isConnected, status } = useAccount();
  const { chain } = useNetwork();
  const { connectors, connect, pendingConnector, isPending: isConnecting, error: connectError } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();

  const { data: balanceData, isLoading: isBalanceLoading } = useBalance({
    address,
    enabled: Boolean(address),
    watch: true
  });

  const availableConnectors = connectors.filter((item) => item.available());

  return (
    <GlassCard className="animate-fadeInUp">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Root Wallet</h2>
        <Badge tone={isConnected ? "emerald" : "slate"}>{status}</Badge>
      </div>

      {isConnected && address ? (
        <GlassSubCard className="mt-4" innerClassName="space-y-3 text-xs text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">Address:</span> {shortAddress(address)}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Connector:</span> {connector?.name ?? "Unknown"}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Chain:</span> {chain?.name ?? "Unknown"} ({formatChainId(chainId)})
          </p>
          <p>
            <span className="font-semibold text-slate-900">Balance:</span>{" "}
            {isBalanceLoading ? "loading..." : `${formatBalance(balanceData?.formatted)} ${balanceData?.symbol ?? "ETH"}`}
          </p>

          <button
            type="button"
            className="garden-button garden-button-soft mt-2 text-xs"
            onClick={() => disconnect()}
            disabled={isDisconnecting}
          >
            Disconnect
          </button>
        </GlassSubCard>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-600">Connect Argent X or Braavos to plant and vote with your own root.</p>

          {availableConnectors.length === 0 ? (
            <GlassSubCard className="mt-3" innerClassName="text-xs text-slate-600">
              <p>No Starknet wallet detected. Install Argent X or Braavos first.</p>
            </GlassSubCard>
          ) : (
            <div className="space-y-2">
              {availableConnectors.map((item) => {
                const waiting = isConnecting && pendingConnector?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="garden-button garden-button-primary flex w-full items-center justify-between text-sm disabled:opacity-60"
                    onClick={() => connect({ connector: item })}
                    disabled={isConnecting}
                  >
                    <span>{item.name}</span>
                    <span className="text-xs text-white/75">{waiting ? "linking..." : "connect"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {connectError && (
            <GlassSubCard className="mt-3" innerClassName="text-xs text-rose-800">
              <p>{connectError.message}</p>
            </GlassSubCard>
          )}

          <p className="text-xs text-slate-500">RPC: {process.env.NEXT_PUBLIC_RPC_URL ?? "not configured"}</p>
        </div>
      )}
    </GlassCard>
  );
}
