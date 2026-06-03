"use client";

import { RiMoonLine, RiSunLine } from "react-icons/ri";

import { Button } from "@/components/ui/button";
import { useThemeTransition } from "@/components/use-theme-transition";

export function ThemeSwitcher() {
  const { activeTheme, mounted, toggleLabel, toggleTheme } = useThemeTransition();
  const buttonTheme = mounted ? activeTheme : "light";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-fd-muted-foreground hover:text-fd-accent-foreground"
      onClick={toggleTheme}
      aria-label={toggleLabel}
      suppressHydrationWarning
    >
      {buttonTheme === "dark" ? (
        <RiMoonLine className="size-4.5 text-current" suppressHydrationWarning />
      ) : (
        <RiSunLine className="size-4.5 text-current" suppressHydrationWarning />
      )}
      <span className="sr-only" suppressHydrationWarning>
        {toggleLabel}
      </span>
    </Button>
  );
}
