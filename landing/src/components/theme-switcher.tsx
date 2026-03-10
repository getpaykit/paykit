"use client";

import { Moon, Sun } from "lucide-react";

import { useThemeTransition } from "@/components/theme-transition-provider";
import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { activeTheme, mounted, toggleTheme } = useThemeTransition();
  const buttonTheme = mounted ? activeTheme : "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-fd-muted-foreground hover:text-fd-accent-foreground"
      onClick={toggleTheme}
      aria-label={buttonTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      suppressHydrationWarning
    >
      {buttonTheme === "dark" ? (
        <Moon className="size-4.5 text-current" suppressHydrationWarning />
      ) : (
        <Sun className="size-4.5 text-current" suppressHydrationWarning />
      )}
      <span className="sr-only">
        {buttonTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      </span>
    </Button>
  );
}
