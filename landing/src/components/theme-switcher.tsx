"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { setThemeWithRevealTransition } from "@/lib/theme-reveal-transition";

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? resolvedTheme : "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-fd-muted-foreground hover:text-fd-accent-foreground"
      onClick={(event) =>
        setThemeWithRevealTransition({
          nextTheme: activeTheme === "dark" ? "light" : "dark",
          setTheme,
          source: event.currentTarget,
        })
      }
      aria-label={activeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      suppressHydrationWarning
    >
      {activeTheme === "dark" ? (
        <Moon className="size-4.5 text-current" suppressHydrationWarning />
      ) : (
        <Sun className="size-4.5 text-current" suppressHydrationWarning />
      )}
      <span className="sr-only">
        {activeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      </span>
    </Button>
  );
}
