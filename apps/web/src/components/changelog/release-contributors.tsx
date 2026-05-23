import Link from "next/link";

type ReleaseContributorsProps = {
  contributors: string[];
};

export function ReleaseContributors({ contributors }: ReleaseContributorsProps) {
  if (contributors.length === 0) return null;

  return (
    <section className="mt-2 pt-6">
      <h3 className="text-foreground/80 text-sm font-medium">Contributors</h3>
      <p className="text-foreground/40 mt-1 text-xs leading-relaxed">
        Thanks to everyone who contributed to this release.
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {contributors.map((username) => (
          <li key={username}>
            <Link
              href={`https://github.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <span className="text-foreground/60 group-hover:text-foreground/85 font-mono text-xs">
                @{username}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
