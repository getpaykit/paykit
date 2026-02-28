import { ArrowRight, Github } from "lucide-react";

import { CodeBlock } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/conts";

const initCode = `const paykit = createPayKit({
  database: prisma(client),
  providers: [
    stripe({
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    }),
  ],
});`;

export function HeroSection() {
  return (
    <section className="relative pt-14 md:pt-18">
      <div className="absolute inset-0 bg-grid text-white/[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="section-container relative z-10 py-24 md:py-32 border-y border-border grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-12 lg:gap-16 items-center">
        {/* Left: text */}
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-6">
            Open source · TypeScript-first
          </p>

          <h1 className="section-title leading-tight">
            Payments orchestration
            <br />
            for modern SaaS.
          </h1>

          <p className="mt-5 text-lg text-muted-foreground max-w-md">
            One TypeScript API. Any provider. Your database is the source of
            truth.
          </p>

          <div className="flex gap-3 mt-8 flex-wrap">
            <Button size="lg" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Github className="size-4" />
                Star on GitHub
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#waitlist">
                Join Waitlist
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Right: code block */}
        <CodeBlock code={initCode} filename="paykit.config.ts" />
      </div>
    </section>
  );
}
