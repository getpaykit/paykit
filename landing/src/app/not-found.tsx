"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { MiniNavBar } from "@/components/layout/mini-nav-bar";
import { Providers } from "@/components/providers";
import { Button } from "@/components/ui/button";

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function NotFound() {
  return (
    <Providers>
      <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-5 sm:px-6 lg:px-7">
        <MiniNavBar />
        {/* Grid dot background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 0.5px, transparent 0.5px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Watermark */}
        <span
          aria-hidden="true"
          className="text-foreground pointer-events-none absolute font-sans text-[clamp(10rem,30vw,22rem)] leading-none font-bold tracking-tighter opacity-[0.015] select-none"
        >
          404
        </span>

        {/* Content */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative flex flex-col items-center gap-4 text-center"
        >
          <motion.p
            variants={item}
            className="text-foreground/30 font-mono text-xs tracking-widest uppercase"
          >
            Error 404
          </motion.p>

          <motion.h1
            variants={item}
            className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl"
          >
            Page not found
          </motion.h1>

          <motion.p variants={item} className="text-foreground/50 max-w-xs text-sm">
            This route doesn't exist. Head back to the homepage.
          </motion.p>

          <motion.div variants={item} className="pt-2">
            <Button className="rounded-none" render={<Link href="/" />} nativeButton={false}>
              <ArrowLeft />
              Go home
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </Providers>
  );
}
