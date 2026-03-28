import type { ReactNode } from "react";

import { SectionContainer } from "@/components/layout/section-container";
import { CodeTabs } from "@/components/ui/code-tabs";

export function ConfigurationSection({
  handlerCodeBlock,
  serverCodeBlock,
}: {
  handlerCodeBlock: ReactNode;
  serverCodeBlock: ReactNode;
}) {
  return (
    <SectionContainer className="py-6">
      <div className="mb-5">
        <span className="text-foreground/60 dark:text-foreground/40 text-xs tracking-wider uppercase">
          Configuration
        </span>
      </div>

      <div className="relative">
        <CodeTabs
          defaultTab="paykit.ts"
          tabs={[
            { name: "paykit.ts", content: serverCodeBlock },
            { name: "route.ts", content: handlerCodeBlock },
          ]}
        />
      </div>
    </SectionContainer>
  );
}
