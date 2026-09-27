"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

type ActiveTheme = "dark" | "light";
type ThemeMode = ActiveTheme | "system";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => void;
};

function getSystemTheme(systemTheme?: string): ActiveTheme {
  if (systemTheme === "dark" || systemTheme === "light") {
    return systemTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useThemeTransition() {
  const { resolvedTheme, setTheme, systemTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeMode: ThemeMode = theme === "dark" || theme === "light" ? theme : "system";
  const activeTheme: ActiveTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const activeSystemTheme: ActiveTheme = mounted ? getSystemTheme(systemTheme) : "light";
  const nextMode: ThemeMode =
    themeMode === "system" ? (activeTheme === "dark" ? "light" : "dark") : "system";
  const nextAppliedTheme: ActiveTheme = nextMode === "system" ? activeSystemTheme : nextMode;
  const toggleLabel =
    nextMode === "system"
      ? `Use system theme (${activeSystemTheme})`
      : `Switch to ${nextAppliedTheme} theme`;

  const toggleTheme = () => {
    if (!mounted) return;

    const documentWithTransition = document as DocumentWithViewTransition;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !documentWithTransition.startViewTransition
    ) {
      setTheme(nextMode);
      return;
    }

    documentWithTransition.startViewTransition(() => flushSync(() => setTheme(nextMode)));
  };

  return {
    activeTheme,
    mounted,
    themeMode,
    toggleLabel,
    toggleTheme,
  };
}
