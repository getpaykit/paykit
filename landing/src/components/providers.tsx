"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ThemeTransitionProvider } from "@/components/theme-transition-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{
        attribute: "class",
        enableSystem: true,
        disableTransitionOnChange: true,
      }}
    >
      <ThemeTransitionProvider>
        {children}
        <Toaster />
      </ThemeTransitionProvider>
    </RootProvider>
  );
}
