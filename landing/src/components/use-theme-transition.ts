"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

type ActiveTheme = "dark" | "light";

type ViewTransitionLike = {
  finished: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => Promise<void> | void) => ViewTransitionLike;
};

function applyThemeToDocument(theme: ActiveTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: ActiveTheme = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const toggleTheme = () => {
    const nextTheme: ActiveTheme = activeTheme === "dark" ? "light" : "dark";

    if (!mounted || isTransitioning) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTheme(nextTheme);
      return;
    }

    const documentWithTransition = document as DocumentWithViewTransition;

    if (!documentWithTransition.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    const runTransition = async () => {
      setIsTransitioning(true);
      document.documentElement.dataset.themeTransition = "active";

      try {
        const transition = documentWithTransition.startViewTransition(() => {
          applyThemeToDocument(nextTheme);

          flushSync(() => {
            setTheme(nextTheme);
          });
        });

        await transition.finished;
      } finally {
        delete document.documentElement.dataset.themeTransition;
        setIsTransitioning(false);
      }
    };

    void runTransition();
  };

  return {
    activeTheme,
    mounted,
    toggleTheme,
  };
}
