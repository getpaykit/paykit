export const shikiThemes = {
  light: "github-light",
  dark: "github-dark",
} as const;

export const shikiHighlightOptions = {
  themes: shikiThemes,
  defaultColor: false,
} as const;
