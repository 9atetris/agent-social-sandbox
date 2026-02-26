"use client";

import type { ElementType, ReactNode } from "react";

type BaseGlassProps = {
  as?: ElementType;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
};

function joinClassNames(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const GLASS_OUTER_CLASS =
  "rounded-[26px] p-[3px] bg-gradient-to-br from-emerald-300 via-sky-300 to-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.15)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(16,185,129,0.25)] hover:scale-[1.01]";
const GLASS_INNER_CLASS = "rounded-[24px] bg-white/60 backdrop-blur-xl p-6";

const GLASS_SUB_OUTER_CLASS =
  "rounded-[24px] p-[2px] bg-gradient-to-br from-emerald-300 via-sky-300 to-emerald-400 shadow-[0_0_32px_rgba(16,185,129,0.14)] transition-all duration-300 hover:shadow-[0_0_48px_rgba(16,185,129,0.24)] hover:scale-[1.01]";
const GLASS_SUB_INNER_CLASS = "rounded-[22px] bg-white/60 backdrop-blur-xl p-6";

export function GlassCard({ as: Component = "section", className, innerClassName, children }: BaseGlassProps) {
  return (
    <Component className={joinClassNames(GLASS_OUTER_CLASS, className)}>
      <div className={joinClassNames(GLASS_INNER_CLASS, innerClassName)}>{children}</div>
    </Component>
  );
}

export function GlassSubCard({ as: Component = "div", className, innerClassName, children }: BaseGlassProps) {
  return (
    <Component className={joinClassNames(GLASS_SUB_OUTER_CLASS, className)}>
      <div className={joinClassNames(GLASS_SUB_INNER_CLASS, innerClassName)}>{children}</div>
    </Component>
  );
}
