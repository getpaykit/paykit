"use client";

import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";

import { useThemeTransition } from "@/components/theme-transition-provider";
import { Button } from "@/components/ui/button";

function getToggleOrigin(event: MouseEvent<HTMLButtonElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function ThemeSwitcher() {
  const { activeTheme, toggleTheme } = useThemeTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-fd-muted-foreground hover:text-fd-accent-foreground cursor-pointer"
      onClick={(event) => {
        toggleTheme(getToggleOrigin(event));
      }}
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
