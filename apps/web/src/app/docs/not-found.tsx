import { ArrowLeft, BookOpenText, House } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function DocsNotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--fd-nav-height))] items-center justify-center px-6 py-16">
      <Empty className="border-border/60 bg-card/40 mx-auto max-w-xl rounded-2xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenText className="size-4" />
          </EmptyMedia>
          <EmptyTitle className="text-base sm:text-lg">Documentation page not found</EmptyTitle>
          <EmptyDescription>
            The docs page you requested does not exist or may have moved. Start from the docs index
            or head back to the homepage.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="sm:flex-row sm:justify-center">
          <Button render={<Link href="/docs/get-started" />} nativeButton={false}>
            <BookOpenText />
            Open docs
          </Button>
          <Button render={<Link href="/" />} nativeButton={false} variant="ghost">
            <House />
            Go home
          </Button>
        </EmptyContent>

        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <ArrowLeft className="size-3.5" />
          Try the sidebar or search to find another page.
        </div>
      </Empty>
    </div>
  );
}
