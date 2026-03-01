import { GithubIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/conts";

export function HeaderSection() {
  return (
    <header className="h-14">
      <div className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 font-semibold text-foreground"
          >
            <Image
              src="/brand/logo-lockup.svg"
              alt="paykit"
              width={90}
              height={22}
            />
          </a>

          <Button variant="outline" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={GithubIcon} size={16} />
              Star on GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
