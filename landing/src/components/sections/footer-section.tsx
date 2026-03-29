"use client";

import { Github } from "lucide-react";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { Section, SectionContent } from "@/components/layout/section";
import { ThemeToggle } from "@/components/theme-toggle";
import { URLs } from "@/lib/consts";

const footerLinks = [{ label: "Author", href: URLs.authorX }];

export function FooterSection() {
  return (
    <Section label="07 Footer" last>
      <SectionContent>
        <div
          className="pointer-events-none absolute inset-0 select-none"
          aria-hidden="true"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
            opacity: 0.03,
          }}
        />

        <div className="relative">
          <p className="text-foreground/60 dark:text-foreground/50 text-center text-base tracking-tight">
            Own your payments with confidence in minutes.
          </p>

          <div className="mt-4 flex items-center justify-center gap-4">
            <Link
              href="/docs"
              className="bg-foreground text-background inline-flex items-center gap-1.5 px-5 py-2 font-mono text-xs tracking-wider uppercase transition-opacity hover:opacity-90"
            >
              Read Docs
            </Link>
            <a
              href={URLs.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              className="border-foreground/12 text-foreground/50 dark:text-foreground/40 hover:text-foreground/70 hover:border-foreground/25 inline-flex items-center gap-1.5 border px-4 py-2 font-mono text-xs tracking-wider uppercase transition-all"
            >
              <Github className="size-3.5" />
              View on GitHub
            </a>
          </div>
        </div>

        <div className="relative mt-10 pt-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
              {footerLinks.map((link, i) => (
                <span key={link.label} className="flex items-center">
                  <Link
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group text-foreground/35 hover:text-foreground/70 inline-flex items-center gap-1 font-mono text-xs transition-colors"
                  >
                    {link.label}
                  </Link>
                  {i < footerLinks.length - 1 && (
                    <span className="text-foreground/10 mx-1 text-xs select-none">/</span>
                  )}
                </span>
              ))}
            </div>

            <div className="flex w-full shrink-0 items-center justify-between sm:w-auto sm:gap-4">
              <span className="text-foreground/35 dark:text-foreground/20 font-mono text-xs">
                © {new Date().getFullYear()} PayKit
              </span>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-foreground/10 hidden select-none sm:inline">·</span>
                <Link
                  href={URLs.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter/X"
                  className="text-foreground/30 hover:text-foreground/60 transition-colors"
                >
                  <Icons.XIcon className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={URLs.githubRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="text-foreground/30 hover:text-foreground/60 transition-colors"
                >
                  <Github className="h-4 w-4" />
                </Link>
                <div className="text-foreground/15 flex h-4 w-4 items-center justify-center select-none">
                  |
                </div>
                <div className="-ml-4 sm:-ml-5">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionContent>
    </Section>
  );
}
