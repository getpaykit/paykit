import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactElement, ReactNode } from "react";

import {
  CategoryFolderIcon,
  getDocsCategoryIcon,
  getDocsPageIcon,
  isEnabledProviderPage,
  isProviderPage,
} from "@/components/docs/docs-icons";
import { SidebarCategoryAccordion } from "@/components/docs/sidebar-category-accordion";
import { LogoLockup } from "@/components/icons/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { URLs } from "@/lib/consts";
import { source } from "@/lib/source";

function normalizeName(name: string): string {
  return name.toLowerCase().replaceAll("-", " ").trim();
}

function withCategoryFolderDefaults(node: PageTree.Node): PageTree.Node {
  if (node.type !== "folder" || node.collapsible !== undefined) {
    return node;
  }

  return {
    ...node,
    collapsible: false,
    defaultOpen: true,
  };
}

function groupCategories(nodes: PageTree.Node[]): PageTree.Node[] {
  const grouped: PageTree.Node[] = [];
  let currentCategory: PageTree.Folder | null = null;

  for (const node of nodes) {
    if (node.type === "separator" && node.name) {
      currentCategory = {
        type: "folder",
        name: node.name,
        collapsible: true,
        defaultOpen: false,
        children: [],
      } as PageTree.Folder;

      const icon = typeof node.name === "string" ? getDocsCategoryIcon(node.name) : undefined;
      (
        currentCategory as PageTree.Folder & {
          icon?: ReactNode;
        }
      ).icon = <CategoryFolderIcon icon={icon} />;

      grouped.push(currentCategory);
      continue;
    }

    let mappedNode =
      node.type === "folder"
        ? {
            ...node,
            children: groupCategories(node.children),
          }
        : node;

    if (mappedNode.type === "page") {
      const nameStr = typeof mappedNode.name === "string" ? mappedNode.name : "";
      const icon = nameStr ? getDocsPageIcon(nameStr) : undefined;

      if (icon) {
        (
          mappedNode as PageTree.Item & {
            icon?: ReactElement;
          }
        ).icon = icon;
      }

      if (nameStr && isProviderPage(nameStr) && !isEnabledProviderPage(nameStr)) {
        mappedNode = {
          ...mappedNode,
          name: (
            <span className="flex w-full items-center">
              {nameStr}
              <span className="bg-fd-muted text-fd-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
                SOON
              </span>
            </span>
          ),
          url: "#",
        };
      }
    }

    if (
      mappedNode.type === "folder" &&
      currentCategory &&
      normalizeName(String(mappedNode.name)) === normalizeName(String(currentCategory.name))
    ) {
      for (const child of mappedNode.children) {
        currentCategory.children.push(withCategoryFolderDefaults(child));
      }
      continue;
    }

    if (currentCategory) {
      currentCategory.children.push(withCategoryFolderDefaults(mappedNode));
      continue;
    }

    grouped.push(mappedNode);
  }

  return grouped;
}

function withCollapsibleCategories(tree: PageTree.Root): PageTree.Root {
  return {
    ...tree,
    children: groupCategories(tree.children),
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  const tree = withCollapsibleCategories(source.pageTree);

  return (
    <div className="h-dvh overflow-x-hidden overflow-y-auto scroll-smooth">
      <DocsLayout
        tree={tree}
        themeSwitch={{
          enabled: false,
        }}
        sidebar={{
          footer: (
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="docs-sidebar-github-button text-fd-muted-foreground hover:text-fd-accent-foreground"
              >
                <a
                  href={URLs.githubRepo}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub repository"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-4.5"
                    aria-hidden="true"
                  >
                    <path d="M12 .297a12 12 0 0 0-3.79 23.39c.6.111.82-.26.82-.577v-2.234c-3.338.726-4.042-1.61-4.042-1.61a3.18 3.18 0 0 0-1.334-1.756c-1.09-.745.084-.73.084-.73a2.52 2.52 0 0 1 1.84 1.238a2.55 2.55 0 0 0 3.487.995a2.55 2.55 0 0 1 .76-1.6c-2.665-.303-5.466-1.332-5.466-5.93a4.64 4.64 0 0 1 1.235-3.221a4.3 4.3 0 0 1 .117-3.176s1.008-.323 3.3 1.23a11.4 11.4 0 0 1 6.006 0c2.291-1.553 3.297-1.23 3.297-1.23a4.3 4.3 0 0 1 .12 3.176a4.63 4.63 0 0 1 1.233 3.22c0 4.61-2.806 5.624-5.479 5.921a2.85 2.85 0 0 1 .814 2.21v3.284c0 .32.216.694.825.576A12 12 0 0 0 12 .297" />
                  </svg>
                </a>
              </Button>
              <ThemeSwitcher />
            </div>
          ),
        }}
        nav={{
          title: (
            <div className="flew-row flex items-center">
              <LogoLockup className="h-4.5" />
            </div>
          ),
          url: "/",
        }}
      >
        <SidebarCategoryAccordion />
        {children}
      </DocsLayout>
    </div>
  );
}
