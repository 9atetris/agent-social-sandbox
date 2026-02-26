"use client";

export function MachineGardenBackground() {
  return (
    <div aria-hidden className="machine-garden-bg pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="machine-garden-gradient absolute inset-0" />
      <div className="machine-garden-orb machine-garden-orb-a" />
      <div className="machine-garden-orb machine-garden-orb-b" />
      <div className="machine-garden-orb machine-garden-orb-c" />
    </div>
  );
}
