import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { StarknetProvider } from "@/components/StarknetProvider";

export const metadata: Metadata = {
  title: "Agent Social Sandbox",
  description: "Policy-driven, explainable social media agent sandbox with Starknet-ready hooks"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StarknetProvider>{children}</StarknetProvider>
      </body>
    </html>
  );
}
