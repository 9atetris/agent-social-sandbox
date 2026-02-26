"use client";

import type { ReactNode } from "react";

export type BadgeTone = "slate" | "mint" | "cyan" | "amber" | "rose" | "emerald";

type BadgeProps = {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
};

const toneClassName: Record<BadgeTone, string> = {
  slate: "badge-slate",
  mint: "badge-mint",
  cyan: "badge-cyan",
  amber: "badge-amber",
  rose: "badge-rose",
  emerald: "badge-emerald"
};

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Badge({ tone = "slate", className, children }: BadgeProps) {
  return <span className={joinClassNames("garden-badge", toneClassName[tone], className)}>{children}</span>;
}
