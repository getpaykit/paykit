"use client";

import type { ComponentProps } from "react";
import { RiMoonLine, RiSunLine } from "react-icons/ri";

import { Button } from "@/components/ui/button";
import { useThemeTransition } from "@/components/use-theme-transition";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({
  className,
  size = "icon",
  variant = "ghost",
}: Pick<ComponentProps<typeof Button>, "className" | "size" | "variant">) {
  const { toggleLabel, toggleTheme } = useThemeTransition();

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={toggleTheme}
      aria-label={toggleLabel}
      suppressHydrationWarning
    >
      <RiSunLine className="hidden text-current dark:hidden [html.light_&]:block" />
      <RiMoonLine className="hidden text-current [html.dark_&]:block" />
      <span className="sr-only" suppressHydrationWarning>
        {toggleLabel}
      </span>
    </Button>
  );
}
