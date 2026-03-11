"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const TIMING = {
  stagger: 0.08,
  duration: 0.4,
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: TIMING.duration, ease: "easeOut" as const },
  },
};

export default function DocsNotFound() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <DocsPage
      toc={[]}
      full
      breadcrumb={{ enabled: false }}
      footer={{ enabled: false }}
      tableOfContent={{ enabled: false }}
      tableOfContentPopover={{ enabled: false }}
    >
      <DocsBody>
        <div className="relative flex min-h-[70vh] w-full items-center justify-center overflow-hidden px-5 sm:px-6 lg:px-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />
          <span
            aria-hidden
            className="text-fd-foreground pointer-events-none absolute font-sans text-[clamp(8rem,28vw,20rem)] leading-none font-bold tracking-tighter opacity-[0.04] select-none"
          >
            404
          </span>
          <span
            aria-hidden
            className="text-fd-muted-foreground pointer-events-none absolute bottom-[22%] left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 select-none"
          >
            docs
          </span>
          <motion.div
            className="relative flex flex-col items-center gap-4 text-center"
            initial="hidden"
            animate="show"
            variants={
              shouldReduceMotion
                ? undefined
                : {
                    show: {
                      transition: { staggerChildren: TIMING.stagger },
                    },
                  }
            }
          >
            <motion.p
              variants={shouldReduceMotion ? undefined : item}
              className="text-fd-muted-foreground font-mono text-xs tracking-widest uppercase"
            >
              Error 404
            </motion.p>
            <motion.h1
              variants={shouldReduceMotion ? undefined : item}
              className="text-fd-foreground text-2xl font-medium tracking-tight sm:text-3xl"
            >
              Page not found
            </motion.h1>
            <motion.p
              variants={shouldReduceMotion ? undefined : item}
              className="text-fd-muted-foreground max-w-xs text-sm"
            >
              This route doesn't exist. Head back to the docs or homepage.
            </motion.p>
            <motion.div variants={shouldReduceMotion ? undefined : item} className="pt-1">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm">
                  <Link href="/docs/get-started">
                    <ArrowLeft className="size-3.5" />
                    Back to docs
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/">Home</Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </DocsBody>
    </DocsPage>
  );
}
