"use client";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="link"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      suppressHydrationWarning
    >
      {/* Sun icon - visible in light mode */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        className="hidden dark:hidden [html.light_&]:block"
        suppressHydrationWarning
      >
        <g
          fill="none"
          stroke="#888888"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path
            strokeDasharray="2"
            strokeDashoffset="0"
            d="M12 21v1M21 12h1M12 3v-1M3 12h-1"
          />
          <path
            strokeDasharray="2"
            strokeDashoffset="0"
            d="M18.5 18.5l0.5 0.5M18.5 5.5l0.5 -0.5M5.5 5.5l-0.5 -0.5M5.5 18.5l-0.5 0.5"
          />
          <animateTransform
            attributeName="transform"
            dur="30s"
            repeatCount="indefinite"
            type="rotate"
            values="0 12 12;360 12 12"
          />
        </g>
        <circle cx="12" cy="12" r="6" fill="#424242" />
      </svg>
      {/* Moon icon - visible in dark mode */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        className="hidden [html.dark_&]:block"
        suppressHydrationWarning
      >
        <path
          fill="#888888"
          d="M12 21q-3.75 0-6.375-2.625T3 12t2.625-6.375T12 3q.35 0 .688.025t.662.075q-1.025.725-1.638 1.888T11.1 7.5q0 2.25 1.575 3.825T16.5 12.9q1.375 0 2.525-.613T20.9 10.65q.05.325.075.662T21 12q0 3.75-2.625 6.375T12 21"
        />
      </svg>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
