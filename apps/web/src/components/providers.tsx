"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { useThemeTransition } from "@/components/use-theme-transition";

function ThemeHotkey() {
  const { toggleTheme } = useThemeTransition();

  useHotkey(
    "D",
    (event) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.keyCode === 229 ||
        (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))
      ) {
        return;
      }

      event.preventDefault();
      toggleTheme();
    },
    { ignoreInputs: true, preventDefault: false, requireReset: true, stopPropagation: false },
  );

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      search={{
        options: {
          api: "/api/search",
        },
      }}
      theme={{
        attribute: "class",
        enableSystem: true,
        disableTransitionOnChange: true,
        hotKey: false,
      }}
    >
      <ThemeHotkey />
      {children}
      <Toaster />
    </RootProvider>
  );
}
