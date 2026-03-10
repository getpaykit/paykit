"use client";

import { useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type ThemeName = "dark" | "light";
type ThemeToggleOrigin = {
  x: number;
  y: number;
};

type ThemeTransitionContextValue = {
  activeTheme: ThemeName;
  isMounted: boolean;
  isTransitioning: boolean;
  toggleTheme: (origin?: ThemeToggleOrigin) => void;
};

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

type ViewTransitionController = {
  finished: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => ViewTransitionController;
};

const themeWipeClasses = ["theme-wipe-active", "theme-wipe-dark", "theme-wipe-light"] as const;

function getNextTheme(theme: ThemeName): ThemeName {
  return theme === "dark" ? "light" : "dark";
}

function clearThemeWipeClasses() {
  document.documentElement.classList.remove(...themeWipeClasses);
}

function applyResolvedTheme(theme: ThemeName) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function setThemeTransitionOrigin(origin: ThemeToggleOrigin) {
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );

  document.documentElement.style.setProperty("--theme-transition-x", `${origin.x}px`);
  document.documentElement.style.setProperty("--theme-transition-y", `${origin.y}px`);
  document.documentElement.style.setProperty("--theme-transition-full-radius", `${radius}px`);
}

function applyThemeWipeClasses(theme: ThemeName) {
  clearThemeWipeClasses();
  document.documentElement.classList.add("theme-wipe-active");
  document.documentElement.classList.add(theme === "dark" ? "theme-wipe-dark" : "theme-wipe-light");
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
      clearThemeWipeClasses();
    };
  }, []);

  const activeTheme: ThemeName = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const finishTransition = (runId: number) => {
    if (transitionRunRef.current !== runId) {
      return;
    }

    clearThemeWipeClasses();
    setIsTransitioning(false);
  };

  const toggleTheme = (origin?: ThemeToggleOrigin) => {
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

    const fallbackOrigin = {
      x: window.innerWidth - 40,
      y: 40,
    };
    setThemeTransitionOrigin(origin ?? fallbackOrigin);
    applyThemeWipeClasses(nextTheme);

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
