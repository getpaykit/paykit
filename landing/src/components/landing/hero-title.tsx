"use client";

import { motion } from "framer-motion";
import { Sparkle } from "lucide-react";
import Link from "next/link";

export function HeroTitle() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative flex w-full flex-col items-start"
    >
      <div className="space-y-2.5 sm:space-y-4">
        <div className="flex items-center gap-1.5">
          <Sparkle
            className="size-[0.9em] text-neutral-600 dark:text-neutral-100"
            aria-hidden="true"
          />
          <span className="text-sm text-neutral-600 sm:text-base dark:text-neutral-100">
            Own your payments
          </span>
        </div>
        <h1 className="max-w-4xl text-xl leading-tight tracking-tight text-neutral-800 sm:text-2xl md:text-3xl lg:text-[2.5rem] dark:text-neutral-200">
          The first billing framework <br className="hidden lg:block" />
          for <span className="border-foreground/20 border-b border-dashed">TypeScript</span>
        </h1>

        <p className="text-foreground/50 max-w-md text-sm leading-relaxed sm:text-base">
          Define plans and features in code. PayKit handles Stripe, webhooks, and usage state - runs
          inside your app.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 rounded-none bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-100 transition-colors hover:opacity-90 sm:px-5 sm:text-sm dark:bg-neutral-100 dark:text-neutral-900"
          >
            Read Docs
          </Link>
          <div className="group dark:text-foreground/75 relative inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-neutral-600 sm:px-5 sm:text-sm dark:text-neutral-400">
            {/* Diagonal lines background */}
            <span
              className="absolute inset-0 opacity-[0.13]"
              style={{
                backgroundImage: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 4px,
                currentColor 4px,
                currentColor 5px
              )`,
              }}
            />
            {/* Top border */}
            <span className="bg-foreground/22 absolute top-0 -right-[6px] -left-[6px] h-px" />
            {/* Bottom border */}
            <span className="bg-foreground/22 absolute -right-[6px] bottom-0 -left-[6px] h-px" />
            {/* Left border */}
            <span className="bg-foreground/22 absolute -top-[6px] -bottom-[6px] left-0 w-px" />
            {/* Right border */}
            <span className="bg-foreground/22 absolute -top-[6px] right-0 -bottom-[6px] w-px" />
            <span className="text-foreground/50 relative font-mono select-none">$</span>
            <code className="text-foreground/90 relative font-mono">npx paykitjs init</code>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
