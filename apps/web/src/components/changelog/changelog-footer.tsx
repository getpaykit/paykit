"use client";

import { ArrowRight, Github } from "lucide-react";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { URLs } from "@/lib/consts";
import { cn } from "@/lib/utils";

type FooterLink = { label: string; href: string; external?: boolean };

const footerLinks: FooterLink[] = [
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
  { label: "Discord", href: URLs.discord, external: true },
  { label: "Changelog", href: "/changelog" },
];

type ChangelogFooterProps = {
  className?: string;
};

export function ChangelogFooter({ className }: ChangelogFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("border-border/60 mt-16 border-t border-dashed", className)}>
      <div className="px-5 py-8 sm:px-8 lg:px-12 lg:py-10 xl:px-16">
        <Link
          href={`${URLs.githubRepo}/releases`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/45 hover:text-foreground/75 group inline-flex items-center gap-1.5 font-mono text-xs transition-colors"
        >
          View all releases on GitHub
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {footerLinks.map((link, index) => (
              <span key={link.label} className="flex items-center">
                <Link
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-foreground/40 hover:text-foreground/70 text-xs transition-colors"
                >
                  {link.label}
                </Link>
                {index < footerLinks.length - 1 ? (
                  <span className="text-foreground/15 mx-2.5 text-xs select-none">/</span>
                ) : null}
              </span>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-foreground/40 text-xs">© {year} PayKit</span>
            <span className="text-foreground/15 hidden h-3 w-px bg-border sm:block" aria-hidden />
            <div className="flex items-center gap-2.5">
              <Link
                href={URLs.x}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PayKit on X"
                className="text-foreground/35 hover:text-foreground/65 transition-colors"
              >
                <Icons.XIcon className="size-3.5" />
              </Link>
              <Link
                href={URLs.githubRepo}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="PayKit on GitHub"
                className="text-foreground/35 hover:text-foreground/65 transition-colors"
              >
                <Github className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
