"use client";

import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { PanelLeft } from "lucide-react";

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
      <PanelLeft className="size-4" aria-hidden="true" />
    </Button>
  );
}
