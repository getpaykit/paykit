import type { ReactNode } from "react";

import { Section, SectionContent } from "@/components/layout/section";
import { CodeTabs } from "@/components/ui/code-tabs";

export function ConfigurationSection({
  handlerCodeBlock,
  serverCodeBlock,
}: {
  handlerCodeBlock: ReactNode;
  serverCodeBlock: ReactNode;
}) {
  return (
    <Section label="04 Config">
      <SectionContent>
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
      </SectionContent>
    </Section>
  );
}
