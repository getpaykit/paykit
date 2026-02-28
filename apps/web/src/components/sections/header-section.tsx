import { Github } from "lucide-react";
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
              alt="PayKit"
              width={101}
              height={24}
            />
          </a>

          <Button variant="outline" asChild>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              <Github className="size-4" />
              Star on GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
