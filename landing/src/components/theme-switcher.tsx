"use client";

import { Moon, Sun } from "lucide-react";

import { useThemeTransition } from "@/components/theme-transition-provider";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { activeTheme, toggleTheme } = useThemeTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-fd-muted-foreground hover:text-fd-accent-foreground cursor-pointer"
      onClick={toggleTheme}
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
