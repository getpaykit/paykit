"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Copy, Sparkle } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Button } from "../ui/button";

export function HeroTitle() {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText("npx paykitjs init");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

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

        <div className="mt-12 flex flex-wrap items-center gap-3 sm:gap-4">
          <Button
            render={<Link href="/docs" />}
            nativeButton={false}
            size="lg"
            className="rounded-sm px-4 h-9.5"
            variant={"default"}
          >
            Read Docs
          </Button>
          <Button
            variant="ghost"
            onClick={handleCopy}
            size="lg"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group relative gap-1.5 rounded-none border-transparent pr-3.5 h-9.5 text-xs font-medium text-neutral-600 hover:bg-transparent sm:text-sm dark:text-neutral-400 dark:text-foreground/75 dark:hover:bg-transparent"
          >
            {/* Diagonal lines background */}
            <span
              className="absolute inset-0 opacity-[0.13] transition-opacity group-hover:opacity-[0.18]"
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
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute top-0 -right-[6px] -left-[6px] h-px transition-colors" />
            {/* Bottom border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute -right-[6px] bottom-0 -left-[6px] h-px transition-colors" />
            {/* Left border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute -top-[6px] -bottom-[6px] left-0 w-px transition-colors" />
            {/* Right border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute -top-[6px] right-0 -bottom-[6px] w-px transition-colors" />
            <span className="relative flex size-4.5 items-center justify-center">
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute flex items-center justify-center"
                  >
                    <Check className="text-foreground/50 size-3.5" />
                  </motion.span>
                ) : hovered ? (
                  <motion.span
                    key="copy"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute flex items-center justify-center"
                  >
                    <Copy className="text-foreground/50 size-3.5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="chevron"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute flex items-center justify-center"
                  >
                    <ChevronRight className="text-foreground/30 size-4.5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <code className="text-foreground/90 relative font-mono">npx paykitjs init</code>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
