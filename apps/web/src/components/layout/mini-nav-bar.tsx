"use client";

import { motion } from "framer-motion";

import { BrandMenu } from "@/components/web/brand-menu";

import { SectionShell } from "./section";

export function MiniNavBar() {
  return (
    <div className="pointer-events-none fixed top-0 right-0 left-0 z-99 flex items-start [scrollbar-gutter:stable]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="bg-background border-border pointer-events-auto w-full border-b lg:hidden"
      >
        <SectionShell className="flex items-center">
          <BrandMenu
            linkClassName="gap-1 rounded-sm px-5 py-3 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors"
            wordmarkClassName="scale-95"
          />
        </SectionShell>
      </motion.div>

      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.28, delay: 0.04, ease: "easeOut" }}
        className="bg-background border-border pointer-events-auto relative hidden w-full items-stretch justify-center border-b lg:flex"
      >
        <SectionShell>
          <div className="flex h-12 items-center px-12">
            <BrandMenu linkClassName="-ml-2.5 rounded-sm px-2.5 py-2 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors" />
          </div>
        </SectionShell>
      </motion.div>
    </div>
  );
}
