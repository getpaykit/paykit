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
      className="relative w-full px-5 sm:px-6 lg:px-7 pt-14 sm:pt-18 md:pt-24 lg:pt-32 pb-0 flex flex-col items-center text-center"
    >
      <div className="space-y-2 sm:space-y-1">
        <div className="flex items-center justify-center gap-1.5">
          <Sparkle
            className="size-[0.9em] text-neutral-600 dark:text-neutral-100"
            aria-hidden="true"
          />
          <span className="text-sm sm:text-base text-neutral-600 dark:text-neutral-100">
            Own your payments
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl text-neutral-800 dark:text-neutral-200 tracking-tight leading-tight max-w-4xl">
          Open-source payment orchestration for{" "}
          <span className="relative inline-flex overflow-hidden align-bottom">
            <AnimatePresence mode="wait">
              <motion.span
                key={rotatingWords[wordIndex]}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="inline-block border-b border-dashed border-foreground/20"
              >
                {rotatingWords[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-3 sm:pt-4 lg:mt-5">
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openEarlyDevDialog();
            }}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 text-xs sm:text-sm font-medium hover:opacity-90 transition-colors"
          >
            Read Docs
          </Link>
          <a
            href="https://github.com/getpaykit/paykit"
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 text-neutral-600 dark:text-neutral-300 text-xs sm:text-sm font-medium transition-colors group"
          >
            {/* Diagonal lines background */}
            <span
              className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity"
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
            <span className="absolute top-0 -left-[6px] -right-[6px] h-px bg-foreground/20 group-hover:bg-foreground/30 transition-colors" />
            {/* Bottom border */}
            <span className="absolute bottom-0 -left-[6px] -right-[6px] h-px bg-foreground/20 group-hover:bg-foreground/30 transition-colors" />
            {/* Left border */}
            <span className="absolute left-0 -top-[6px] -bottom-[6px] w-px bg-foreground/20 group-hover:bg-foreground/30 transition-colors" />
            {/* Right border */}
            <span className="absolute right-0 -top-[6px] -bottom-[6px] w-px bg-foreground/20 group-hover:bg-foreground/30 transition-colors" />
            <Github className="relative size-4" />
            <span className="relative">View on GitHub</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
