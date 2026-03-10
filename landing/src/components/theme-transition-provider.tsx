"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type ThemeName = "dark" | "light";
type TransitionPhase = "cover" | "reveal";

type ThemeTransitionContextValue = {
  activeTheme: ThemeName;
  isMounted: boolean;
  isTransitioning: boolean;
  toggleTheme: () => void;
};

const ThemeTransitionContext = createContext<ThemeTransitionContextValue | null>(null);

function clearScheduledTimeouts(timeoutIds: number[]) {
  for (const timeoutId of timeoutIds) {
    window.clearTimeout(timeoutId);
  }
}

function getNextTheme(theme: ThemeName): ThemeName {
  return theme === "dark" ? "light" : "dark";
}

function waitForThemePaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function getCurtainBackground(theme: ThemeName) {
  return theme === "dark"
    ? "var(--theme-transition-dark-curtain)"
    : "var(--theme-transition-light-curtain)";
}

function getCurtainShadow(theme: ThemeName) {
  return theme === "dark"
    ? "var(--theme-transition-dark-shadow)"
    : "var(--theme-transition-light-shadow)";
}

function ThemeCurtain({ phase, theme }: { phase: TransitionPhase; theme: ThemeName }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute top-0 right-[-10vw] left-[-10vw] h-[120vh] will-change-transform"
        initial={{ y: "-118%" }}
        animate={phase === "cover" ? { y: "0%" } : { y: "112%" }}
        transition={{
          duration: phase === "cover" ? 0.44 : 0.36,
          ease: [0.23, 1, 0.32, 1],
        }}
        style={{
          backgroundColor: getCurtainBackground(theme),
          boxShadow: getCurtainShadow(theme),
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, transparent 62%, rgba(255,255,255,0.06) 84%, rgba(0,0,0,0.06) 100%)",
          }}
        />
        <div
          className="absolute right-[4%] bottom-[-5.5rem] left-[4%] h-28 rounded-b-[100%]"
          style={{
            backgroundColor: getCurtainBackground(theme),
            boxShadow: getCurtainShadow(theme),
          }}
        />
        <div
          className="absolute right-[10%] bottom-[-3rem] left-[10%] h-16 rounded-b-[100%] opacity-70"
          style={{
            background:
              theme === "dark"
                ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))"
                : "linear-gradient(180deg, rgba(255,255,255,0.68), rgba(255,255,255,0.18))",
          }}
        />
      </motion.div>
    </div>
  );
}

export function ThemeTransitionProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<TransitionPhase | null>(null);
  const [overlayTheme, setOverlayTheme] = useState<ThemeName | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const transitionRunRef = useRef(0);

  useEffect(() => {
    setMounted(true);

    return () => {
      transitionRunRef.current += 1;
      clearScheduledTimeouts(timeoutIdsRef.current);
      timeoutIdsRef.current = [];
    };
  }, []);

  const activeTheme: ThemeName = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const isTransitioning = phase !== null;

  const waitForDelay = (duration: number) => {
    return new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        timeoutIdsRef.current = timeoutIdsRef.current.filter((storedId) => storedId !== timeoutId);
        resolve();
      }, duration);

      timeoutIdsRef.current.push(timeoutId);
    });
  };

  const resetTransition = () => {
    setPhase(null);
    setOverlayTheme(null);
  };

  const toggleTheme = () => {
    if (!mounted || isTransitioning) {
      return;
    }

    const nextTheme = getNextTheme(activeTheme);

    if (shouldReduceMotion) {
      setTheme(nextTheme);
      return;
    }

    const runId = transitionRunRef.current + 1;
    transitionRunRef.current = runId;
    setOverlayTheme(nextTheme);
    setPhase("cover");

    void (async () => {
      await waitForDelay(110);

      if (transitionRunRef.current !== runId) {
        return;
      }

      setTheme(nextTheme);
      await waitForThemePaint();
      await waitForDelay(180);

      if (transitionRunRef.current !== runId) {
        return;
      }

      setPhase("reveal");
      await waitForDelay(320);

      if (transitionRunRef.current !== runId) {
        return;
      }

      resetTransition();
    })();
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
      <div className="relative isolate">
        {mounted && overlayTheme && phase ? (
          <ThemeCurtain phase={phase} theme={overlayTheme} />
        ) : null}
        <div className="relative z-[1]">{children}</div>
      </div>
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
