"use client";

const patternSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" fill="none">
  <g stroke="#0f766e" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 62h18l10-10h16l10 10h18" />
    <circle cx="16" cy="62" r="2.2" fill="#0f766e"/>
    <circle cx="70" cy="52" r="2.2" fill="#0f766e"/>
    <circle cx="88" cy="62" r="2.2" fill="#0f766e"/>
    <path d="M60 76c0-9 8-16 18-16-2 9-9 16-18 16z" />
    <path d="M60 76c0-8-7-14-15-14 1 8 7 14 15 14z" />
  </g>
</svg>
`);

export function MachineGardenBackground() {
  return (
    <div aria-hidden className="machine-garden-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="machine-garden-gradient absolute inset-0" />
      <div className="machine-garden-orb machine-garden-orb-a" />
      <div className="machine-garden-orb machine-garden-orb-b" />
      <div className="machine-garden-orb machine-garden-orb-c" />
      <div
        className="machine-garden-pattern absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${patternSvg}")`
        }}
      />
      <div className="machine-garden-noise absolute inset-0" />
    </div>
  );
}

