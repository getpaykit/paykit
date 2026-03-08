"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

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
      onClick={() => setTheme(activeTheme === "dark" ? "light" : "dark")}
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
