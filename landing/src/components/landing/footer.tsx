import { Github } from "lucide-react";
import Link from "next/link";

import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

const footerLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Blog", href: "/blog" },
  { label: "Community", href: "/community" },
  { label: "Changelog", href: "/changelog" },
];

export default function Footer() {
  return (
    <footer className="border-foreground/[0.06] bg-background relative z-40 w-full overflow-hidden border-t">
      {/* Large watermark logo */}
      <div
        className="pointer-events-none absolute -right-16 -bottom-12 opacity-[0.03] select-none"
        aria-hidden="true"
      >
        <svg
          width="360"
          height="270"
          viewBox="0 0 60 45"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M0 0H15V15H30V30H15V45H0V30V15V0ZM45 30V15H30V0H45H60V15V30V45H45H30V30H45Z"
            className="fill-foreground"
          />
        </svg>
      </div>

      {/* Decorative grid dots */}
      <div
        className="pointer-events-none absolute inset-0 select-none"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          opacity: 0.03,
        }}
      />

      <div className="relative space-y-5 px-5 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5">
          {footerLinks.map((link, i) => (
            <span key={link.label} className="flex items-center">
              <Link
                href={link.href}
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

        <div className="flex items-center justify-between">
          <span className="text-foreground/20 font-mono text-xs">
            © {new Date().getFullYear()} PayKit
          </span>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="https://x.com/getpaykit"
              aria-label="Twitter/X"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Icons.XIcon className="h-3 w-3" />
            </Link>
            <Link
              href="https://github.com/getpaykit"
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
    </footer>
  );
}
