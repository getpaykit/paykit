import { Section, SectionContent } from "@/components/layout/section";
import { sponsors } from "@/components/sections/sponsors-content";
import type { Sponsor } from "@/components/sections/sponsors-content";
import { cn } from "@/lib/utils";

const sponsorLinkClassName =
  "group relative min-w-0 bg-background before:pointer-events-none before:absolute before:inset-0 before:bg-foreground/[0.03] before:opacity-0 before:transition-opacity hover:before:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:before:opacity-100 focus-visible:outline-none";

function CompanySponsorLink({ sponsor }: { sponsor: Sponsor }) {
  return (
    <a
      className={cn(
        sponsorLinkClassName,
        "flex min-h-32 flex-col items-center justify-center gap-2 px-3 py-4 text-center sm:min-h-40 sm:gap-3 sm:px-5 sm:py-6",
      )}
      href={sponsor.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="flex size-12 shrink-0 items-center justify-center">
        <img
          alt={sponsor.imageAlt}
          className="size-9 dark:invert"
          decoding="async"
          height={36}
          loading="lazy"
          src={sponsor.image}
          width={36}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-medium">{sponsor.name}</span>
        <span className="text-muted-foreground mt-0.5 block font-mono text-xs tabular-nums">
          {sponsor.amount}
        </span>
      </span>
    </a>
  );
}

function IndividualSponsorLink({ sponsor }: { sponsor: Sponsor }) {
  return (
    <a
      className={cn(
        sponsorLinkClassName,
        "flex items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-5 sm:py-4",
        sponsor.hideInSingleColumn && "hidden min-[360px]:flex",
      )}
      href={sponsor.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <img
        alt={sponsor.imageAlt}
        className="size-9 shrink-0 rounded-full grayscale transition-[filter] group-hover:grayscale-0 group-focus-visible:grayscale-0"
        decoding="async"
        height={36}
        loading="lazy"
        src={sponsor.image}
        width={36}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{sponsor.name}</span>
        <span className="text-muted-foreground mt-0.5 block font-mono text-xs tabular-nums">
          {sponsor.amount}
        </span>
      </span>
    </a>
  );
}

export function SponsorsSection() {
  const companySponsors = sponsors.filter((sponsor) => sponsor.kind === "company");
  const individualSponsors = sponsors.filter((sponsor) => sponsor.kind === "individual");

  return (
    <Section className="scroll-mt-12" id="sponsors">
      <SectionContent className="relative border-b px-5 py-5 sm:px-8 sm:py-6 lg:px-8 lg:py-6">
        <div className="max-w-lg space-y-2">
          <h2 className="text-foreground/90 text-xl font-medium tracking-tight sm:text-2xl">
            Sponsors
          </h2>
        </div>
        <div className="pointer-events-none absolute inset-0 z-0 flex h-full justify-center">
          <div className="h-full w-px translate-x-px border-r border-dashed border-border" />
        </div>
      </SectionContent>

      <div className="border-b border-l border-border">
        <div className="grid grid-cols-2 bg-border [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:border-border">
          {companySponsors.map((sponsor) => (
            <CompanySponsorLink key={sponsor.name} sponsor={sponsor} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border min-[360px]:grid-cols-2 lg:grid-cols-3">
          {individualSponsors.map((sponsor) => (
            <IndividualSponsorLink key={sponsor.name} sponsor={sponsor} />
          ))}
        </div>
      </div>
    </Section>
  );
}
