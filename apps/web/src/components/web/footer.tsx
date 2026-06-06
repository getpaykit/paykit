import Link from "next/link";

import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { URLs } from "@/lib/consts";

/**
 * Site footer with watermark artwork, decorative grid, copyright, social links,
 * and theme toggle.
 *
 * Decorative elements are aria-hidden; links provide aria labels.
 *
 * @component
 * @returns JSX.Element
 */
export default function Footer() {
  return (
    <footer className="border-foreground/[0.06] bg-background relative z-40 w-full overflow-hidden border-t">
      {/* Large watermark logo */}
      <div
        className="pointer-events-none absolute -right-16 -bottom-12 opacity-[0.03] select-none"
        aria-hidden="true"
      >
        <svg
          width="114"
          height="123"
          viewBox="0 0 114 123"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 0H67V47H0V0Z" fill="white" />
          <path d="M67 0H114V76H67V0Z" fill="white" />
          <path d="M0 76H67V123H0V76Z" fill="white" />
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
        <div className="flex items-center justify-between">
          <span className="text-foreground/20 font-mono text-xs">
            © {new Date().getFullYear()} PayKit
          </span>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href={URLs.x}
              aria-label="Twitter/X"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Icons.XIcon className="h-3 w-3" />
            </Link>
            <Link
              href={URLs.githubOrg}
              aria-label="GitHub"
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
            >
              <Icons.GitHubIcon className="h-4 w-4" />
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
