import { ArrowRight, Star } from "lucide-react";

import { CodeBlock, t } from "@/components/code-block";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/conts";

const initCode = (
  <>
    {t.kw("import")} {t.plain("{")} {t.prop("paykit")} {t.plain("}")}{" "}
    {t.kw("from")} {t.str('"paykit"')}
    {"\n"}
    {t.kw("import")} {t.plain("{")} {t.prop("stripe")} {t.plain("}")}{" "}
    {t.kw("from")} {t.str('"@paykit/stripe"')}
    {"\n"}
    {t.kw("import")} {t.plain("{")} {t.prop("prisma")} {t.plain("}")}{" "}
    {t.kw("from")} {t.str('"@paykit/prisma"')}
    {"\n"}
    {"\n"}
    {t.kw("const")} {t.prop("pk")} {t.plain("=")} {t.fn("paykit")}
    {t.plain("({")}
    {"\n"}
    {"  "}
    {t.prop("database")}
    {t.plain(": ")}
    {t.fn("prisma")}
    {t.plain("(")}
    {t.prop("client")}
    {t.plain("),")}
    {"\n"}
    {"  "}
    {t.prop("providers")}
    {t.plain(": [")}
    {"\n"}
    {"    "}
    {t.fn("stripe")}
    {t.plain("({")}
    {"\n"}
    {"      "}
    {t.prop("secretKey")}
    {t.plain(": ")}
    {t.prop("process")}
    {t.plain(".")}
    {t.prop("env")}
    {t.plain(".")}
    {t.prop("STRIPE_SECRET_KEY")}
    {t.plain("!,")}
    {"\n"}
    {"      "}
    {t.prop("webhookSecret")}
    {t.plain(": ")}
    {t.prop("process")}
    {t.plain(".")}
    {t.prop("env")}
    {t.plain(".")}
    {t.prop("STRIPE_WEBHOOK_SECRET")}
    {t.plain("!,")}
    {"\n"}
    {"    "}
    {t.plain("}),")}
    {"\n"}
    {"  "}
    {t.plain("],")}
    {"\n"}
    {t.plain("});")}
    {"\n"}
  </>
);

export function HeroSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 border-b border-border">
      <div className="absolute inset-0 bg-grid text-white/[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="max-w-6xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* Left: text */}
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-6">
            Open source · TypeScript-first
          </p>

          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-foreground leading-tight">
            Payments orchestration
            <br />
            for modern SaaS.
          </h1>

          <p className="mt-5 text-lg text-muted-foreground max-w-md">
            One TypeScript API. Any provider. Your database is the source of
            truth.
          </p>

          <div className="flex gap-3 mt-8 flex-wrap">
            <Button size="lg" className="rounded-none" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Star className="size-4" />
                Star on GitHub
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-none"
              asChild
            >
              <a href="#waitlist">
                Join Waitlist
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Right: code block */}
        <CodeBlock lineCount={12}>{initCode}</CodeBlock>
      </div>
    </section>
  );
}
