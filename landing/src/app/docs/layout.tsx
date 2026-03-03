import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { LogoLockup } from "@/components/icons/logo";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <LogoLockup className="h-4" />,
        url: "/",
      }}
    >
      {children}
    </DocsLayout>
  );
}
