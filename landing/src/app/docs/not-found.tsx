import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { ArrowLeft, ArrowUpRight, BookOpen, Coins, Sparkles, Webhook } from "lucide-react";
import Link from "next/link";

import { DocsNotFoundGame } from "@/components/docs/docs-not-found-game";
import { LogoLockup } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";

const quickLinks = [
  {
    description: "Start from the setup guide and get a working instance into your app.",
    href: "/docs/get-started/installation",
    icon: BookOpen,
    label: "Installation",
  },
  {
    description: "See the hosted payment flow that PayKit exposes today.",
    href: "/docs/features/checkout",
    icon: Coins,
    label: "Checkout",
  },
  {
    description: "Review the normalized event pipeline and the Next.js webhook route.",
    href: "/docs/features/webhooks",
    icon: Webhook,
    label: "Webhooks",
  },
  {
    description: "Return to the marketing overview if you were looking for the big picture.",
    href: "/",
    icon: ArrowLeft,
    label: "Homepage",
  },
] as const;

function DocsLinkCard({
  description,
  href,
  icon: Icon,
  label,
}: {
  description: string;
  href: string;
  icon: (typeof quickLinks)[number]["icon"];
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-fd-card/50 hover:bg-fd-card border-fd-border flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="bg-fd-muted text-fd-muted-foreground inline-flex size-8 items-center justify-center rounded-lg">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <ArrowUpRight className="text-fd-muted-foreground size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-fd-foreground text-sm font-medium">{label}</p>
        <p className="text-fd-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

export default function DocsNotFound() {
  return (
    <DocsPage
      toc={[]}
      full
      breadcrumb={{ enabled: false }}
      footer={{ enabled: false }}
      tableOfContent={{ enabled: false }}
      tableOfContentPopover={{ enabled: false }}
    >
      <DocsBody>
        <div className="flex max-h-dvh min-h-0 flex-col overflow-hidden">
          <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_auto] lg:gap-6 lg:p-6">
            <section className="bg-fd-card/40 border-fd-border flex min-h-0 flex-col overflow-hidden rounded-2xl border">
              <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)] lg:p-6">
                <div className="min-w-0">
                  <span className="bg-fd-muted text-fd-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-[0.18em] uppercase">
                    404 / docs
                  </span>
                  <DocsTitle className="mt-3 max-w-2xl text-2xl tracking-tight sm:text-3xl lg:mt-4 lg:text-4xl">
                    This page is outside the docs tree.
                  </DocsTitle>
                  <DocsDescription className="mt-2 max-w-xl text-sm leading-relaxed lg:mt-3 lg:text-base">
                    The route you asked for does not exist, or the page has not shipped yet. Jump
                    back into a known section or start from the docs overview.
                  </DocsDescription>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href="/docs/get-started">
                        <ArrowLeft className="size-3.5" />
                        Back to docs
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/">Open homepage</Link>
                    </Button>
                  </div>
                </div>

                <div className="bg-background/70 border-fd-border flex min-h-0 flex-col rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <LogoLockup className="h-4" />
                    <span className="text-fd-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
                      Recovery
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <div className="bg-fd-muted/60 rounded-xl p-3">
                      <p className="text-fd-foreground text-xs font-medium">Try a known path</p>
                      <p className="text-fd-muted-foreground mt-0.5 text-xs">
                        Use one of the jump cards to get back into the docs quickly.
                      </p>
                    </div>
                    <div className="border-fd-border text-fd-muted-foreground rounded-xl border border-dashed px-3 py-2 font-mono text-[10px] leading-5">
                      /docs/get-started/installation
                      <br />
                      /docs/features/checkout
                      <br />
                      /docs/features/webhooks
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="border-fd-border/50 bg-background/30 shrink-0 border-t px-4 py-3 lg:px-6">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="text-fd-muted-foreground size-3.5" aria-hidden="true" />
              <p className="text-fd-foreground text-xs font-medium">Jump back in</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <DocsLinkCard key={link.href} {...link} />
              ))}
            </div>
          </section>
        </div>
      </DocsBody>
      <DocsNotFoundGame />
    </DocsPage>
  );
}
