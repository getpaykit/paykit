"use client";

import Link from "next/link";
import { RiArrowLeftLine } from "react-icons/ri";

import { MiniNavBar } from "@/components/layout/mini-nav-bar";
import { PageTransition } from "@/components/layout/page-transition";
import { Section, SectionContent } from "@/components/layout/section";
import { Providers } from "@/components/providers";
import { Button } from "@/components/ui/button";

/** 404 page shown when a route is missing.
 *
 * @returns JSX.Element
 */
export default function NotFound() {
  return (
    <Providers>
      <MiniNavBar />
      <PageTransition>
        <div className="flex min-h-dvh flex-col">
          <Section last className="flex-1">
            <SectionContent className="relative flex min-h-dvh flex-col items-center justify-center">
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
              <div className="relative flex flex-col items-center gap-4 text-center">
                <p className="text-foreground/30 font-mono text-xs tracking-widest uppercase">
                  Error 404
                </p>

                <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
                  Page not found
                </h1>

                <p className="text-foreground/50 max-w-xs text-sm">
                  This route doesn't exist. Head back to the homepage.
                </p>

                <div className="pt-2">
                  <Button size="lg" render={<Link href="/" />} nativeButton={false}>
                    <RiArrowLeftLine />
                    Go home
                  </Button>
                </div>
              </div>
            </SectionContent>
          </Section>
        </div>
      </PageTransition>
    </Providers>
  );
}
