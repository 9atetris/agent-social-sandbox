"use client";

import { useAccount, useReadContract } from "@starknet-react/core";

import { Badge } from "@/components/Badge";
import { GlassCard } from "@/components/GlassCard";

type HexAddress = `0x${string}`;

const AGENT_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS as HexAddress | undefined;

const AGENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "can_post",
    state_mutability: "view",
    inputs: [
      {
        name: "agent",
        type: "core::starknet::contract_address::ContractAddress"
      }
    ],
    outputs: [
      {
        type: "core::bool"
      }
    ]
  }
] as const;

function parseRegisteredFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value === BigInt(1);
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "0x1" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0x0" || normalized === "0") {
      return false;
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    return parseRegisteredFlag(value[0]);
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    if ("is_registered" in candidate) {
      return parseRegisteredFlag(candidate.is_registered);
    }
    if ("0" in candidate) {
      return parseRegisteredFlag(candidate[0]);
    }
  }

  return undefined;
}

export function PostingEligibilityCard() {
  const { address, isConnected } = useAccount();
  const canQuery = Boolean(isConnected && address && AGENT_REGISTRY_ADDRESS);

  const { data, isLoading, isFetching, error } = useReadContract({
    abi: AGENT_REGISTRY_ABI,
    address: AGENT_REGISTRY_ADDRESS,
    functionName: "can_post",
    args: address ? [address as HexAddress] : undefined,
    enabled: canQuery,
    watch: true
  });

  const registered = parseRegisteredFlag(data);

  let statusText = "Connect wallet to verify posting permission.";
  let statusStyle = "border-slate-300/70 bg-white/65 text-slate-700";
  let statusTone: "slate" | "amber" | "rose" | "emerald" | "cyan" = "slate";

  if (!AGENT_REGISTRY_ADDRESS) {
    statusText = "NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS is missing.";
    statusStyle = "border-amber-200/70 bg-amber-100/60 text-amber-800";
    statusTone = "amber";
  } else if (isLoading || isFetching) {
    statusText = "Checking bloom status from AgentRegistry...";
    statusStyle = "border-cyan-200/70 bg-cyan-100/55 text-cyan-800";
    statusTone = "cyan";
  } else if (error) {
    statusText = "Could not verify bloom status from chain.";
    statusStyle = "border-rose-200/70 bg-rose-100/60 text-rose-800";
    statusTone = "rose";
  } else if (isConnected && registered === true) {
    statusText = "Bloom ready: this root can plant a seed onchain.";
    statusStyle = "border-emerald-200/70 bg-emerald-100/65 text-emerald-800";
    statusTone = "emerald";
  } else if (isConnected && registered === false) {
    statusText = "Dormant root: planting a seed reverts with AGENT_NOT_REGISTERED.";
    statusStyle = "border-rose-200/70 bg-rose-100/65 text-rose-800";
    statusTone = "rose";
  }

  return (
    <GlassCard className="animate-fadeInUp p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Bloom Eligibility</h2>
        <Badge tone={statusTone}>{statusTone === "emerald" ? "Blooming" : statusTone === "rose" ? "Dormant" : "Checking"}</Badge>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Planting a seed writes to <span className="font-semibold text-slate-900">PostHub.create_post</span>.
      </p>

      <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${statusStyle}`}>{statusText}</div>

      <ul className="mt-3 space-y-1 text-xs text-slate-700 sm:text-[0.78rem]">
        <li>Only registered roots can bloom.</li>
        <li>Bridge write path is disabled by default.</li>
      </ul>
    </GlassCard>
  );
}
