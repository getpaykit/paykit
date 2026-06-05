import type { BundledTheme } from "shiki";

export const shikiThemes = {
  light: "github-light" satisfies BundledTheme,
  dark: "github-dark" satisfies BundledTheme,
} as const;

export const shikiHighlightOptions = {
  themes: shikiThemes,
  defaultColor: false,
} as const;

export const shikiInlineTheme = shikiThemes.dark;
