import { HeroReadMe } from "@/components/landing/hero-readme";
import { HeroTitle } from "@/components/landing/hero-title";

export default function HomePage() {
  return (
    <div id="hero" className="relative pt-[45px] lg:pt-0">
      <div className="relative text-foreground">
        <div className="mx-auto w-full max-w-[60rem] flex flex-col">
          <HeroTitle />
          <HeroReadMe />
        </div>
      </div>
    </div>
  );
}
