"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Copy } from "lucide-react";
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
    <div className="relative flex w-full flex-col items-center text-center lg:items-start lg:text-left">
      <div className="space-y-3.5 sm:space-y-5">
        <h1 className="max-w-4xl text-3xl leading-tight tracking-tight text-neutral-800 sm:text-3xl md:text-3xl lg:text-[2.55rem] dark:text-neutral-200">
          The billing framework <br />
          for <span className="border-foreground/20 border-b border-dashed">TypeScript</span>
        </h1>

        <p className="text-foreground/80 max-w-md text-[13px] leading-relaxed sm:text-base">
          Define plans and features in code. PayKit handles Stripe, webhooks, and usage state - runs
          inside your app.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-8 sm:gap-4 lg:mt-12 lg:justify-start">
          <Button
            render={<Link href="/docs" />}
            nativeButton={false}
            size="lg"
            className="h-9.5 px-5"
            variant="default"
          >
            Read Docs
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            size="lg"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="h-9.5 pr-4"
          >
            <span className="flex size-4 items-center justify-center">
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute"
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
                    className="absolute"
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
                    className="absolute"
                  >
                    <ChevronRight className="text-foreground/30 size-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <code className="font-mono">npx paykitjs init</code>
          </Button>
        </div>
      </div>
    </div>
  );
}
