import type { ReactNode } from "react";

import { DocsLayout } from "@/components/docs/docs-layout";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return <DocsLayout tree={source.pageTree}>{children}</DocsLayout>;
}
