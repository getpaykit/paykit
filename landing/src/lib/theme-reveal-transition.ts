"use client";

type StartViewTransitionResult = {
  ready: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (updateCallback: () => void) => StartViewTransitionResult;
};

export function setThemeWithRevealTransition({
  nextTheme,
  setTheme,
  source,
}: {
  nextTheme: "light" | "dark";
  setTheme: (theme: string) => void;
  source: HTMLElement;
}) {
  const doc = document as DocumentWithViewTransition;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || typeof doc.startViewTransition !== "function") {
    setTheme(nextTheme);
    return;
  }

  const rect = source.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const maxX = Math.max(x, window.innerWidth - x);
  const maxY = Math.max(y, window.innerHeight - y);
  const endRadius = Math.hypot(maxX, maxY);

  const transition = doc.startViewTransition(() => {
    setTheme(nextTheme);
  });

  void transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: 560,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      setTheme(nextTheme);
    });
}
