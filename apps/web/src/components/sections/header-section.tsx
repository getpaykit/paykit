import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/conts";

export function HeaderSection() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <a
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          <span className="text-sm tracking-tight">PayKit</span>
          <span className="text-xs text-muted-foreground font-mono border border-border px-1.5 py-0.5">
            alpha
          </span>
        </a>

        <Button size="sm" variant="outline" className="rounded-none" asChild>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            Star on GitHub
          </a>
        </Button>
      </div>
    </header>
  );
}
