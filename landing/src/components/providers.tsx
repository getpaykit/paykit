"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{
        attribute: "class",
        enableSystem: true,
        disableTransitionOnChange: true,
      }}
    >
      {children}
      <Toaster />
    </RootProvider>
  );
}
