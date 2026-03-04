import { BookOpenIcon } from "@heroicons/react/20/solid";
import { ArrowDownOnSquareIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import { FolderIcon, PlayIcon, SquaresPlusIcon } from "@heroicons/react/24/solid";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactElement, ReactNode } from "react";

import { SidebarCategoryAccordion } from "@/components/docs/sidebar-category-accordion";
import { LogoLockup } from "@/components/icons/logo";
import { GITHUB_URL } from "@/lib/consts";
import { source } from "@/lib/source";

const categoryIcons = {
  "get started": <PlayIcon className="docs-category-icon size-3! shrink-0" />,
  integrations: <SquaresPlusIcon className="docs-category-icon size-3! shrink-0" />,
  project: <FolderIcon className="docs-category-icon size-3! shrink-0" />,
} as const;

const pageIcons = {
  introduction: <BookOpenIcon className="docs-category-icon size-3! shrink-0" />,
  installation: <ArrowDownOnSquareIcon className="docs-category-icon size-3! shrink-0" />,
  "basic usage": <BanknotesIcon className="docs-category-icon size-3! shrink-0" />,
} as const;

const providerPageIcons = {
  stripe: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      className="docs-category-icon size-3! shrink-0 text-current"
    >
      <path
        fill="currentColor"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409c0-.831.683-1.305 1.901-1.305c2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0C9.667 0 7.589.654 6.104 1.872C4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219c2.585.92 3.445 1.574 3.445 2.583c0 .98-.84 1.545-2.354 1.545c-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813c1.664-1.305 2.525-3.236 2.525-5.732c0-4.128-2.524-5.851-6.594-7.305z"
      />
    </svg>
  ),
  paypal: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 154.728 190.5"
      className="docs-category-icon size-3! shrink-0 text-current"
    >
      <g transform="translate(898.192 276.071)">
        <path
          d="M-837.663-237.968a5.49 5.49 0 0 0-5.423 4.633l-9.013 57.15-8.281 52.514-.005.044.01-.044 8.281-52.514c.421-2.669 2.719-4.633 5.42-4.633h26.404c26.573 0 49.127-19.387 53.246-45.658.314-1.996.482-3.973.52-5.924v-.003h-.003c-6.753-3.543-14.683-5.565-23.372-5.565z"
          fill="currentColor"
        />
        <path
          d="M-766.506-232.402c-.037 1.951-.207 3.93-.52 5.926-4.119 26.271-26.673 45.658-53.246 45.658h-26.404c-2.701 0-4.999 1.964-5.42 4.633l-8.281 52.514-5.197 32.947a4.46 4.46 0 0 0 4.405 5.153h28.66a5.49 5.49 0 0 0 5.423-4.633l7.55-47.881c.423-2.669 2.722-4.636 5.423-4.636h16.876c26.573 0 49.124-19.386 53.243-45.655 2.924-18.649-6.46-35.614-22.511-44.026z"
          fill="currentColor"
        />
        <path
          d="M-870.225-276.071a5.49 5.49 0 0 0-5.423 4.636l-22.489 142.608a4.46 4.46 0 0 0 4.405 5.156h33.351l8.281-52.514 9.013-57.15a5.49 5.49 0 0 1 5.423-4.633h47.782c8.691 0 16.621 2.025 23.375 5.563.46-23.917-19.275-43.666-46.412-43.666z"
          fill="currentColor"
        />
      </g>
    </svg>
  ),
  polar: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="-0.5 -0.5 16 16"
      fill="none"
      className="docs-category-icon size-3! shrink-0 text-current"
    >
      <path
        d="M7.5 14.337c-3.776 0-6.837-3.061-6.837-6.837C.663 3.724 3.724.663 7.5.663c3.776 0 6.837 3.061 6.837 6.837 0 3.776-3.061 6.837-6.837 6.837Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M7.5 14.337c-1.51 0-2.735-3.061-2.735-6.837C4.765 3.724 5.99.663 7.5.663c1.51 0 2.735 3.061 2.735 6.837 0 3.776-1.225 6.837-2.735 6.837Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M5.449 13.654c-2.051-.684-2.735-3.685-2.735-5.812 0-2.127 1.026-4.786 3.419-6.495"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
      <path
        d="M9.551 1.346c2.051.684 2.735 3.685 2.735 5.812 0 2.127-1.026 4.786-3.419 6.495"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </svg>
  ),
  lemonsqueezy: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      className="docs-category-icon size-3! shrink-0 text-current"
    >
      <path
        fill="currentColor"
        d="m7.4916 10.835 2.3748-6.5114a3.1497 3.1497 0 0 0-.065-2.3418C9.0315.183 6.9427-.398 5.2928.265 3.643.929 2.71 2.4348 3.512 4.3046l2.8197 6.5615c.219.509.97.489 1.16-.03m1.6798 1.0969 6.5334-2.7758c2.1699-.9219 2.7218-3.6907 1.022-5.2905l-.068-.063c-1.6669-1.5469-4.4217-1.002-5.3706 1.0359L8.3566 11.135c-.234.503.295 1.0199.8159.7979m.373.87 6.6454-2.5119c2.2078-.8349 4.6206.745 4.5886 3.0398l-.002.09c-.048 2.2358-2.3938 3.7376-4.5536 2.9467l-6.6724-2.4418a.595.595 0 0 1-.006-1.1229m-.386 1.9269 6.4375 2.9767a3.2997 3.2997 0 0 1 1.6658 1.6989c.769 1.7998-.283 3.6396-1.9328 4.3016-1.6499.662-3.4097.235-4.2097-1.6359l-2.8027-6.5694c-.217-.509.328-1.009.8419-.772"
      />
    </svg>
  ),
  paddle: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="15"
      height="15"
      viewBox="0 0 160 201"
      className="docs-category-icon size-3! shrink-0 text-current"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M32.154 10.694V21.113l34.575.751c33.315.724 34.94.966 44.623 6.66 32.453 19.077 29.294 71.09-5.193 85.472-5.992 2.5-15.922 3.3-40.958 3.3H32.154v41.49 41.49h11.702 11.702v-30.632-30.632l26.064-.855c22.107-.726 27.679-1.634 36.703-5.991 15.017-7.254 29.536-22.83 35.153-37.716 9.43-24.991 2.627-55.38-16.353-73.051C118.533 4.09 105.065.275 62.559.275H32.154v10.42zm0 26.143c0 1.387-1.915 6.477-4.255 11.311-4.213 8.704-16.779 18.085-24.226 18.085-2.015 0-3.434 1.757-3.434 4.255 0 2.87 1.42 4.255 4.362 4.255 11.183 0 23.508 11.673 26.394 24.999 2.155 9.95 5.853 8.496 10.734-4.219 4.59-11.957 14.662-20.78 23.719-20.78 3.585 0 5.004-1.207 5.004-4.256 0-2.498-1.42-4.255-3.434-4.255-7.447 0-20.013-9.381-24.226-18.085-2.34-4.834-4.255-9.923-4.255-11.31 0-1.386-1.436-2.52-3.191-2.52s-3.192 1.134-3.192 2.52z"
      />
    </svg>
  ),
} as const;

function getCategoryIcon(name: string): ReactElement | undefined {
  return categoryIcons[name.toLowerCase() as keyof typeof categoryIcons];
}

function getPageIcon(name: string): ReactElement | undefined {
  const key = name.toLowerCase();
  return (
    pageIcons[key as keyof typeof pageIcons] ??
    providerPageIcons[key as keyof typeof providerPageIcons]
  );
}

function CategoryFolderIcon({ icon }: { icon?: ReactElement }) {
  return (
    <>
      {icon}
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        className="docs-category-chevron pointer-events-none absolute top-1/2 right-5 size-4 -translate-y-1/2 transition-transform duration-150"
      />
    </>
  );
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

      const icon = typeof node.name === "string" ? getCategoryIcon(node.name) : undefined;
      (
        currentCategory as PageTree.Folder & {
          icon?: ReactElement;
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
      const icon = typeof mappedNode.name === "string" ? getPageIcon(mappedNode.name) : undefined;
      if (icon) {
        (
          mappedNode as PageTree.Item & {
            icon?: ReactElement;
          }
        ).icon = icon;
      }
    }

    if (mappedNode.type === "folder" && currentCategory && mappedNode.collapsible === undefined) {
      mappedNode = {
        ...mappedNode,
        collapsible: false,
        defaultOpen: true,
      };
    }

    if (currentCategory) {
      currentCategory.children.push(mappedNode);
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
        sidebar={{
          footer: (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="docs-sidebar-github-button text-fd-muted-foreground hover:text-fd-accent-foreground hover:bg-fd-accent order-first inline-flex size-8 items-center justify-center rounded-md transition-colors"
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
          ),
        }}
        nav={{
          title: (
            <div className="flew-row flex items-center">
              <LogoLockup className="h-4.5" />
              <span className="text-foreground/50 mb-[5px] ml-2.5 scale-110 leading-none font-normal">
                docs
              </span>
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
