"use client";

import { useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type ThemeName = "dark" | "light";

type ThemeTransitionContextValue = {
  activeTheme: ThemeName;
  isMounted: boolean;
  isTransitioning: boolean;
  toggleTheme: () => void;
};

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

type ViewTransitionController = {
  finished: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => ViewTransitionController;
};

const themeTurnClasses = ["theme-turn-active", "theme-turn-dark", "theme-turn-light"] as const;

function getNextTheme(theme: ThemeName): ThemeName {
  return theme === "dark" ? "light" : "dark";
}

function clearThemeTurnClasses() {
  document.documentElement.classList.remove(...themeTurnClasses);
}

function applyResolvedTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function applyThemeTurnClasses(theme: ThemeName) {
  clearThemeTurnClasses();
  document.documentElement.classList.add("theme-turn-active");
  document.documentElement.classList.add(theme === "dark" ? "theme-turn-dark" : "theme-turn-light");
}

export function ThemeTransitionProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionRunRef = useRef(0);

  useEffect(() => {
    setMounted(true);

    return () => {
      transitionRunRef.current += 1;
      clearThemeTurnClasses();
    };
  }, []);

  const activeTheme: ThemeName = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const finishTransition = (runId: number) => {
    if (transitionRunRef.current !== runId) {
      return;
    }

    clearThemeTurnClasses();
    setIsTransitioning(false);
  };

  const toggleTheme = () => {
    if (!mounted || isTransitioning) {
      return;
    }

    const nextTheme = getNextTheme(activeTheme);

    if (shouldReduceMotion) {
      applyResolvedTheme(nextTheme);
      setTheme(nextTheme);
      return;
    }

    const runId = transitionRunRef.current + 1;
    transitionRunRef.current = runId;
    setIsTransitioning(true);

    const documentWithViewTransition = document as DocumentWithViewTransition;
    if (!documentWithViewTransition.startViewTransition) {
      applyResolvedTheme(nextTheme);
      setTheme(nextTheme);
      window.requestAnimationFrame(() => {
        finishTransition(runId);
      });
      return;
    }

    applyThemeTurnClasses(nextTheme);

    const transition = documentWithViewTransition.startViewTransition(() => {
      applyResolvedTheme(nextTheme);
      setTheme(nextTheme);
    });

    void transition.finished.finally(() => {
      finishTransition(runId);
    });
  };

  return (
    <ThemeTransitionContext.Provider
      value={{
        activeTheme,
        isMounted: mounted,
        isTransitioning,
        toggleTheme,
      }}
    >
      {children}
    </ThemeTransitionContext.Provider>
  );
}

export function useThemeTransition() {
  const context = useContext(ThemeTransitionContext);

  if (!context) {
    throw new Error("useThemeTransition must be used within ThemeTransitionProvider");
  }

  return context;
}
