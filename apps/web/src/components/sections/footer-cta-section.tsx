import { ArrowRight, Github } from "lucide-react";

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
          <Button size="lg" className="rounded-none" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <Github className="size-4" />
              Star on GitHub
            </a>
          </Button>
          <Button size="lg" variant="outline" className="rounded-none" asChild>
            <a href="mailto:hello@paykit.dev">
              Join Waitlist
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
