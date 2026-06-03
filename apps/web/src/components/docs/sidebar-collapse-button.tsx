"use client";

import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { RiSideBarLine } from "react-icons/ri";

import { Button } from "@/components/ui/button";

export function SidebarCollapseButton() {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="docs-sidebar-collapse-button text-fd-muted-foreground hover:text-fd-accent-foreground size-7 rounded-md max-md:hidden"
      type="button"
      aria-label="Collapse Sidebar"
      data-collapsed={collapsed}
      onClick={() => {
        setCollapsed((prev) => !prev);
      }}
    >
      <RiSideBarLine className="size-4" aria-hidden="true" />
    </Button>
  );
}
