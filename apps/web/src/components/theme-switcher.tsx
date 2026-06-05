"use client";

import { RiMoonLine, RiSunLine } from "react-icons/ri";

import { Button } from "@/components/ui/button";
import { useThemeTransition } from "@/components/use-theme-transition";

export function ThemeSwitcher() {
  const { toggleLabel, toggleTheme } = useThemeTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-accent-foreground"
      onClick={toggleTheme}
      aria-label={toggleLabel}
      suppressHydrationWarning
    >
      <RiSunLine className="hidden size-4.5 text-current dark:hidden [html.light_&]:block" />
      <RiMoonLine className="hidden size-4.5 text-current [html.dark_&]:block" />
      <span className="sr-only" suppressHydrationWarning>
        {toggleLabel}
      </span>
    </Button>
  );
}
