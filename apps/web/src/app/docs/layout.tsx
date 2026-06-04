import type { ReactNode } from "react";

import { DocsLayout } from "@/components/docs/docs-layout";
import { Wordmark } from "@/components/icons/wordmark";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      navTitle={
        <div className="flex flex-row items-center">
          <Wordmark title="PayKit" className="h-3.5" />
        </div>
      }
    >
      {children}
    </DocsLayout>
  );
}
