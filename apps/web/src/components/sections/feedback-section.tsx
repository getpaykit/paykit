import { Section, SectionContent } from "@/components/layout/section";
import { tweets } from "@/components/sections/feedback-content";
import type { Tweet } from "@/components/sections/feedback-content";

const columns = [1, 2, 3, 4].map((column) => tweets.filter((tweet) => tweet.column === column));

function VerifiedIcon() {
  return (
    <svg className="size-3.5 shrink-0" fill="none" height="14" width="14" viewBox="0 0 14 14">
      <path
        d="M10.811 2.479c.133.322.388.577.71.711l1.127.467a1.31 1.31 0 0 1 .71.71c.133.322.133.683 0 1.005l-.466 1.126a1.31 1.31 0 0 0 0 1.005l.466 1.126a1.31 1.31 0 0 1 0 1.004 1.31 1.31 0 0 1-.711.71l-1.126.466a1.31 1.31 0 0 0-.711.71l-.467 1.127a1.31 1.31 0 0 1-1.715.71l-1.126-.466a1.31 1.31 0 0 0-1.004.001l-1.127.466a1.31 1.31 0 0 1-1.714-.71l-.467-1.127c-.133-.322-.388-.577-.71-.711l-1.127-.467a1.31 1.31 0 0 1-.71-.71 1.31 1.31 0 0 1 0-1.004l.466-1.126c.133-.322.133-.683-.001-1.004L.643 5.371a1.31 1.31 0 0 1 0-1.005 1.31 1.31 0 0 1 .711-.71l1.126-.466c.321-.133.577-.388.71-.709l.467-1.127c.133-.322.389-.577.71-.71a1.31 1.31 0 0 1 1.005 0l1.126.466c.322.133.683.133 1.004-.001L8.63.644c.322-.133.683-.133 1.004 0s.577.389.71.71z"
        fill="#1C9BF0"
      />
      <path
        d="M9.742 5.165c.094-.147.125-.325.087-.495s-.141-.318-.288-.412-.325-.125-.495-.087-.318.141-.412.288l-2.57 4.038-1.176-1.47c-.109-.136-.267-.223-.44-.242s-.347.031-.483.14-.223.267-.243.44.031.347.14.483l1.75 2.188c.065.082.149.146.244.189s.2.062.304.056.206-.036.296-.089.166-.126.222-.215z"
        fill="#fff"
        fillRule="evenodd"
      />
    </svg>
  );
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <figure className="relative flex flex-col justify-end overflow-hidden border-b bg-background p-4 last:border-b-0 md:px-4.5">
      <a
        className="absolute inset-0 z-10"
        href={tweet.link}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="sr-only">View tweet by {tweet.name}</span>
      </a>
      <div className="flex items-center gap-2">
        <span className="relative flex size-8 shrink-0 overflow-hidden rounded-full bg-secondary">
          <img
            className="size-full aspect-square"
            alt={`${tweet.name}'s profile picture`}
            src={tweet.avatar}
          />
        </span>
        <figcaption className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <cite className="truncate text-sm not-italic">{tweet.name}</cite>
            {tweet.checkmark && <VerifiedIcon />}
          </div>
          <span className="text-muted-foreground -mt-0.5 block truncate text-[12px] tracking-tight">
            @{tweet.handle}
          </span>
        </figcaption>
      </div>
      <div className="text-foreground/80 mt-2 flex-1 ps-10 text-sm tracking-wide">
        <p>{tweet.text}</p>
      </div>
    </figure>
  );
}

export function FeedbackSection() {
  return (
    <Section>
      <SectionContent className="relative border-b px-5 py-5 sm:px-8 sm:py-6 lg:px-8 lg:py-6">
        <div className="max-w-lg space-y-2">
          <h2 className="text-foreground/90 text-xl font-medium tracking-tight sm:text-2xl">
            Feedback
          </h2>
        </div>
        <div className="pointer-events-none absolute inset-0 z-0 flex h-full justify-center">
          <div className="h-full w-px border-r border-dashed border-border" />
        </div>
      </SectionContent>

      <div className="relative max-h-[31rem] overflow-hidden border-b border-l border-border">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="flex min-h-full flex-col bg-background">
              {column.map((tweet) => (
                <TweetCard key={`${tweet.handle}-${tweet.text}`} tweet={tweet} />
              ))}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-px h-40 bg-linear-to-b from-transparent via-background/70 to-background" />
      </div>
    </Section>
  );
}
