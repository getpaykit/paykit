import { AUTHOR_URL, DISCORD_URL, GITHUB_URL, X_URL } from "@/lib/conts";

const links = [
  { label: "GitHub", href: GITHUB_URL },
  { label: "X", href: X_URL },
  { label: "Discord", href: DISCORD_URL },
  { label: "@maxktz", href: AUTHOR_URL },
];

export function SiteFooterSection() {
  return (
    <footer className="py-8">
      <div className="section-container flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-sm text-muted-foreground font-mono">
          paykit · MIT License
        </span>

        <nav className="flex items-center gap-5">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
