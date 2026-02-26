"use client";

import type { ElementType, ReactNode } from "react";

type GlassCardProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function GlassCard({ as: Component = "section", className, children }: GlassCardProps) {
  return <Component className={joinClassNames("glass-card", className)}>{children}</Component>;
}

