"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Section, SectionContent } from "@/components/layout/section";
import { Button } from "@/components/ui/button";

export function CTASection() {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText("npx paykitjs init");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  return (
    <Section>
      <SectionContent>
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="text-foreground/90 text-xl font-medium tracking-tight sm:text-2xl">
            Ready to add billing?
          </h2>
          <p className="text-foreground/80 max-w-md text-sm leading-relaxed sm:text-base">
            One command to get started. Define your plans, connect Stripe, and ship billing in
            minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button render={<Link href="/docs" />} nativeButton={false} size="lg" className="px-4">
              Get Started
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="pr-4"
              onClick={handleCopy}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
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
      </SectionContent>
    </Section>
  );
}
