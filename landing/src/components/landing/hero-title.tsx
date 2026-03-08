"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Github, Sparkle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { URLs } from "@/lib/consts";

import { useEarlyDevDialog } from "./early-dev-dialog";

const rotatingWords = ["TypeScript", "modern SaaS", "Next.js apps"];
const enterEase = [0.23, 1, 0.32, 1] as const;
const moveEase = [0.645, 0.045, 0.355, 1] as const;

export function HeroTitle() {
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  const shouldReduceMotion = useReducedMotion();
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % rotatingWords.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: enterEase }}
      style={{ willChange: "transform, opacity" }}
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
            {shouldReduceMotion ? (
              <span className="border-foreground/20 inline-block border-b border-dashed">
                {rotatingWords[wordIndex]}
              </span>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={rotatingWords[wordIndex]}
                  initial={{ y: "70%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-70%", opacity: 0 }}
                  transition={{ duration: 0.26, ease: moveEase }}
                  style={{ willChange: "transform, opacity" }}
                  className="border-foreground/20 inline-block border-b border-dashed"
                >
                  {rotatingWords[wordIndex]}
                </motion.span>
              </AnimatePresence>
            )}
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
            href={URLs.githubRepo}
            target="_blank"
            rel="noopener noreferrer"
            className="github-cta-button group dark:text-foreground/75 hover:dark:text-foreground/90 relative inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-neutral-600 transition-[color,transform] duration-200 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 sm:px-5 sm:text-sm"
          >
            {/* Diagonal lines background */}
            <span
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden="true"
            >
              <span className="absolute -inset-x-4 inset-y-0 opacity-0 transition-opacity duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-[0.22]">
                <span className="github-cta-stripes absolute inset-0" />
              </span>
            </span>
            {/* Top border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute top-0 -right-[6px] -left-[6px] h-px transition-colors" />
            {/* Bottom border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute -right-[6px] bottom-0 -left-[6px] h-px transition-colors" />
            {/* Left border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute -top-[6px] -bottom-[6px] left-0 w-px transition-colors" />
            {/* Right border */}
            <span className="bg-foreground/22 group-hover:bg-foreground/30 absolute -top-[6px] right-0 -bottom-[6px] w-px transition-colors" />
            <Github className="relative size-4" />
            <span className="relative">View on GitHub</span>
          </a>
        </div>
      </div>
    </motion.div>
  );
}
