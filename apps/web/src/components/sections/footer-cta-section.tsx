import { ArrowRight02Icon, GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/conts";

export function FooterCtaSection() {
  return (
    <section id="waitlist" className="text-center">
      <div className="section-container py-24 border-b border-border">
        <h2 className="section-title">
          Open source. TypeScript-first.
          <br />
          Coming soon.
        </h2>

        <p className="mt-4 text-muted-foreground">
          MIT License · No vendor lock-in · Your data, your database.
        </p>

        <div className="flex gap-3 mt-8 justify-center flex-wrap">
          <Button size="lg" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={GithubIcon} size={16} />
              Star on GitHub
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="mailto:hello@paykit.dev">
              Join Waitlist
              <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
