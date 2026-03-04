"use client";

import { useEffect } from "react";

function isCategoryButton(button: HTMLButtonElement): boolean {
  return button.querySelector(".docs-category-chevron") !== null;
}

export function SidebarCategoryAccordion() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;

      const button = event.target.closest(
        "button[aria-expanded]",
      ) as HTMLButtonElement | null;
      if (!button || !isCategoryButton(button)) return;

      const sidebarRoot = button.closest("#nd-sidebar, #nd-sidebar-mobile");
      if (!sidebarRoot) return;

      // Wait for Fumadocs to update expanded state, then collapse siblings.
      queueMicrotask(() => {
        if (button.getAttribute("aria-expanded") !== "true") return;

        const categoryButtons = Array.from(
          sidebarRoot.querySelectorAll("button[aria-expanded]"),
        ).filter(
          (item): item is HTMLButtonElement =>
            item instanceof HTMLButtonElement && isCategoryButton(item),
        );

        for (const sibling of categoryButtons) {
          if (
            sibling !== button &&
            sibling.getAttribute("aria-expanded") === "true"
          ) {
            sibling.click();
          }
        }
      });
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
