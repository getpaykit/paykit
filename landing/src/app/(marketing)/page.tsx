import { HeroReadMe } from "@/components/landing/hero-readme";
import { HeroTitle } from "@/components/landing/hero-title";
import { homePageStructuredData } from "@/lib/consts";

export default function HomePage() {
  return (
    <>
      {homePageStructuredData.map((schema, index) => (
        <script
          key={`${schema["@type"]}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div id="hero" className="relative pt-[45px] lg:pt-0">
        {/* Grid background */}
        <div
          className="hero-dots pointer-events-none absolute inset-0 select-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-foreground) 1.2px, transparent 1.2px)",
            backgroundSize: "16px 16px",
            opacity: 0.09,
          }}
        />
        <div className="text-foreground relative">
          <div className="mx-auto flex w-full max-w-[60rem] flex-col">
            <HeroTitle />
            <HeroReadMe />
          </div>
        </div>
      </div>
    </>
  );
}
