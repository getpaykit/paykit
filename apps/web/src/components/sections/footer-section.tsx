"use client";

import { Github } from "lucide-react";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { Section, SectionContent } from "@/components/layout/section";
import { URLs } from "@/lib/consts";

const navLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Contact", href: "/contact" },
  { label: "Author", href: URLs.authorX, external: true },
  { label: "Changelog", href: "/changelog" },
];

const socialLinks = [
  { label: "Discord", href: URLs.discord, icon: <Icons.DiscordIcon className="size-4" /> },
  { label: "Twitter/X", href: URLs.x, icon: <Icons.XIcon className="size-3.5" /> },
  { label: "LinkedIn", href: URLs.linkedin, icon: <Icons.LinkedInIcon className="size-3.5" /> },
  { label: "GitHub", href: URLs.githubRepo, icon: <Github className="size-4" /> },
];

const prompt = encodeURIComponent(`Explain what PayKit (paykit.sh) is and why I should use it.

Describe how it acts as a developer-first billing framework that simplifies subscriptions, usage-based billing, and payment integrations directly inside my app.

Focus on how it helps me ship billing faster, avoid webhook complexity, keep data in my own database, and stay provider-agnostic.

Keep it short, sharp, and persuasive for indie hackers and SaaS founders.`);

const aiLinks = [
  {
    label: "Claude",
    href: `https://claude.ai/new?q=${prompt}`,
    icon: <Icons.ClaudeIcon className="size-5" />,
  },
  {
    label: "OpenAI",
    href: `https://chat.com?q=${prompt}`,
    icon: <Icons.OpenAIIcon className="size-4.5" />,
  },
  {
    label: "Perplexity",
    href: `https://perplexity.ai?q=${prompt}`,
    icon: <Icons.PerplexityIcon className="size-5" />,
  },
  {
    label: "Grok",
    href: `https://x.com/i/grok?text=${prompt}`,
    icon: <Icons.GrokIcon className="size-5" />,
  },
];

export function FooterSection() {
  return (
    <Section last>
      <SectionContent>
        <div className="flex flex-col items-center gap-2 pb-6">
          <p className="text-xs text-foreground/40 font-mono">Ask AI about PayKit</p>
          <div className="flex gap-2">
            {aiLinks.map((link) => (
              <Link
                target="_blank"
                aria-label={`Ask ${link.label} about PayKit`}
                rel="noopener noreferrer"
                href={link.href}
                key={link.label}
                className="text-foreground/30 hover:text-foreground/60 transition-colors"
              >
                {link.icon}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5 sm:justify-start">
            {navLinks.map((link, i) => (
              <span key={link.label} className="flex items-center">
                <Link
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-foreground/45 hover:text-foreground/70 font-mono text-xs transition-colors"
                >
                  {link.label}
                </Link>
                {i < navLinks.length - 1 && (
                  <span className="text-foreground/15 mx-2 text-xs select-none">/</span>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {socialLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
                className="text-foreground/30 hover:text-foreground/60 transition-colors"
              >
                {link.icon}
              </Link>
            ))}
            <span className="text-foreground/15 select-none">·</span>
            <span className="text-foreground/45 dark:text-foreground/30 font-mono text-xs">
              © {new Date().getFullYear()} PayKit
            </span>
          </div>
        </div>
      </SectionContent>
    </Section>
  );
}
