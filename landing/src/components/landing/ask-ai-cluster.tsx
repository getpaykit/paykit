import Link from "next/link";
import type { IconType } from "react-icons";
import { RiClaudeLine, RiOpenaiLine, RiPerplexityLine } from "react-icons/ri";

const askAiPrompt = [
  "As a potential customer, I want to understand what PayKit (paykit.sh) offers.",
  "",
  "Explain what payment orchestration is and how PayKit helps software companies run checkout, subscriptions, saved payment methods, direct charges, and provider webhooks through one API.",
  "",
  "Keep it simple and focus on the key benefits for indie hackers, SaaS founders, and engineering teams that want less vendor lock-in and more control over billing logic.",
].join("\n");

const GrokIcon: IconType = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="m19.25 5.08-9.52 9.67 6.64-4.96c.33-.24.79-.15.95.23.82 1.99.45 4.39-1.17 6.03-1.63 1.64-3.89 2.01-5.96 1.18l-2.26 1.06c3.24 2.24 7.18 1.69 9.64-.8 1.95-1.97 2.56-4.66 1.99-7.09-.82-3.56.2-4.98 2.29-7.89L22 2.3zM9.72 14.75h.01zM8.35 15.96c-2.33-2.25-1.92-5.72.06-7.73 1.47-1.48 3.87-2.09 5.97-1.2l2.25-1.05c-.41-.3-.93-.62-1.52-.84a7.45 7.45 0 0 0-8.13 1.65c-2.11 2.14-2.78 5.42-1.63 8.22.85 2.09-.54 3.57-1.95 5.07-.5.53-1 1.06-1.4 1.62z" />
  </svg>
);

const askAiLinks = [
  {
    label: "ChatGPT",
    href: `https://chat.openai.com/?q=${encodeURIComponent(askAiPrompt)}`,
    Icon: RiOpenaiLine,
  },
  {
    label: "Claude",
    href: `https://claude.ai/new?q=${encodeURIComponent(askAiPrompt)}`,
    Icon: RiClaudeLine,
  },
  {
    label: "Grok",
    href: `https://x.com/i/grok?text=${encodeURIComponent(askAiPrompt)}`,
    Icon: GrokIcon,
  },
  {
    label: "Perplexity",
    href: `https://www.perplexity.ai/?q=${encodeURIComponent(askAiPrompt)}`,
    Icon: RiPerplexityLine,
  },
] as const;

export function AskAiCluster() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-2">
        {askAiLinks.map(({ label, href, Icon }) => (
          <Link
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Ask ${label} about PayKit`}
            className="border-foreground/[0.08] text-foreground/35 hover:border-foreground/18 hover:bg-foreground/[0.03] hover:text-foreground/70 flex size-10 items-center justify-center border bg-transparent transition-colors duration-200 ease-out"
          >
            <Icon className="size-5" />
          </Link>
        ))}
      </div>
      <p className="text-foreground/30 font-mono text-[10px] tracking-[0.28em] uppercase sm:text-[11px]">
        Ask AI About PayKit
      </p>
    </div>
  );
}
