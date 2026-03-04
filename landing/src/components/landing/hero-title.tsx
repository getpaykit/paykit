"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Github, Sparkle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useEarlyDevDialog } from "./early-dev-dialog";

const rotatingWords = ["TypeScript", "modern SaaS", "Next.js apps"];

export function HeroTitle() {
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % rotatingWords.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative flex w-full flex-col items-center px-5 pt-14 pb-0 text-center sm:px-6 sm:pt-18 md:pt-24 lg:px-7 lg:pt-32"
    >
      <div className="space-y-2 sm:space-y-1">
        <div className="flex items-center justify-center gap-1.5">
          <Sparkle
            className="size-[0.9em] text-neutral-600 dark:text-neutral-100"
            aria-hidden="true"
          />
          <span className="text-sm text-neutral-600 sm:text-base dark:text-neutral-100">
            Own your payments
          </span>
        </div>
        <h1 className="max-w-4xl text-xl leading-tight tracking-tight text-neutral-800 sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl dark:text-neutral-200">
          Open-source payment orchestration for{" "}
          <span className="relative inline-flex overflow-hidden align-bottom">
            <AnimatePresence mode="wait">
              <motion.span
                key={rotatingWords[wordIndex]}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="border-foreground/20 inline-block border-b border-dashed"
              >
                {rotatingWords[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3 sm:gap-3 sm:pt-4 lg:mt-5">
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openEarlyDevDialog();
            }}
            className="inline-flex items-center gap-1.5 bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-100 transition-colors hover:opacity-90 sm:px-5 sm:text-sm dark:bg-neutral-100 dark:text-neutral-900"
          >
            Read Docs
          </Link>
          <a
            href="https://github.com/getpaykit/paykit"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-neutral-600 transition-colors sm:px-5 sm:text-sm dark:text-neutral-300"
          >
            {/* Diagonal lines background */}
            <span
              className="absolute inset-0 opacity-[0.04] transition-opacity group-hover:opacity-[0.08]"
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
            <span className="bg-foreground/20 group-hover:bg-foreground/30 absolute top-0 -right-[6px] -left-[6px] h-px transition-colors" />
            {/* Bottom border */}
            <span className="bg-foreground/20 group-hover:bg-foreground/30 absolute -right-[6px] bottom-0 -left-[6px] h-px transition-colors" />
            {/* Left border */}
            <span className="bg-foreground/20 group-hover:bg-foreground/30 absolute -top-[6px] -bottom-[6px] left-0 w-px transition-colors" />
            {/* Right border */}
            <span className="bg-foreground/20 group-hover:bg-foreground/30 absolute -top-[6px] right-0 -bottom-[6px] w-px transition-colors" />
            <Github className="relative size-4" />
            <span className="relative">View on GitHub</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
