import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { Github } from "lucide-react";
import { cloneElement } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  CategoryFolderIcon,
  getDocsCategoryIcon,
  getDocsPageIcon,
  isEnabledProviderPage,
  isProviderPage,
  isSoonPage,
} from "@/components/docs/docs-icons";
import { SidebarCategoryAccordion } from "@/components/docs/sidebar-category-accordion";
import { SidebarCollapseButton } from "@/components/docs/sidebar-collapse-button";
import { LogoLockup } from "@/components/icons/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { URLs, VERSION_TEXT } from "@/lib/consts";
import { source } from "@/lib/source";

function normalizeName(name: string): string {
  return name.toLowerCase().replaceAll("-", " ").trim();
}

function withPageLabel(name: string, icon?: ReactElement, badge?: ReactNode): ReactNode {
  if (!icon && badge === undefined) {
    return name;
  }

  return (
    <span key={`label-${name}`} className="flex w-full items-center gap-2">
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="min-w-0 truncate">{name}</span>
      {badge !== undefined ? <span className="ml-auto flex shrink-0">{badge}</span> : null}
    </span>
  );
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
      const icon =
        nameStr && getDocsPageIcon(nameStr)
          ? cloneElement(getDocsPageIcon(nameStr) as ReactElement, {
              key: `icon-${nameStr}`,
            })
          : undefined;

      if (
        nameStr &&
        ((isProviderPage(nameStr) && !isEnabledProviderPage(nameStr)) || isSoonPage(nameStr))
      ) {
        mappedNode = {
          ...mappedNode,
          name: withPageLabel(
            nameStr,
            icon,
            <span className="bg-fd-muted text-fd-muted-foreground rounded-sm px-1.5 py-0.5 text-[10px] leading-none font-medium">
              SOON
            </span>,
          ),
          url: "#",
        };
      } else if (icon) {
        mappedNode = {
          ...mappedNode,
          name: withPageLabel(nameStr, icon),
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
                render={
                  <a
                    href={URLs.githubRepo}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub repository"
                  />
                }
                nativeButton={false}
                variant="ghost"
                size="icon"
                className="docs-sidebar-github-button text-fd-muted-foreground hover:text-fd-accent-foreground"
              >
                <Github className="size-4.5" aria-hidden="true" />
              </Button>
              <ThemeSwitcher />
            </div>
          ),
        }}
        nav={{
          children: <SidebarCollapseButton />,
          title: (
            <div className="flew-row flex items-center">
              <LogoLockup className="h-4.5" />
              {VERSION_TEXT && (
                <Badge
                  className="text-muted-foreground mb-0.5 ml-3 rounded-xs px-1"
                  variant={"outline"}
                >
                  {VERSION_TEXT}
                </Badge>
              )}
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
