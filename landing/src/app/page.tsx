import { HeroReadMe } from "@/components/landing/hero-readme";
import { HeroTitle } from "@/components/landing/hero-title";
import { getCommunityStats, getContributors } from "@/lib/community-stats";

export default async function HomePage() {
  const contributors = getContributors();
  const communityStats = await getCommunityStats();

  return (
    <div id="hero" className="relative pt-[45px] lg:pt-0">
      <div className="relative text-foreground">
        <div className="mx-auto w-full max-w-[60rem] flex flex-col">
          <HeroTitle />
          <HeroReadMe
            contributors={contributors}
            stats={{
              npmDownloads: communityStats.npmDownloads,
              githubStars: communityStats.githubStars,
            }}
          />
        </div>
      </div>
    </div>
  );
}
