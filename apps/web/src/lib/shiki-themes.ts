import type { BundledTheme } from "shiki";

export const shikiThemes = {
  light: "gruvbox-light-medium" satisfies BundledTheme,
  dark: "vesper" satisfies BundledTheme,
} as const;

export const shikiHighlightOptions = {
  themes: shikiThemes,
  defaultColor: false,
} as const;
