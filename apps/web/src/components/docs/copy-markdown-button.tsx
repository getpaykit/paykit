"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiMarkdownLine,
} from "react-icons/ri";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CopyMarkdownButton({ markdownUrl }: { markdownUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [markdown, setMarkdown] = useState<string>();

  const onClick = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    void Promise.resolve(markdown)
      .then((cached) => {
        if (cached !== undefined) return cached;

        return fetch(markdownUrl).then((res) => {
          if (!res.ok) throw new Error("fetch failed");
          return res.text();
        });
      })
      .then((text) => {
        setMarkdown(text);
        return navigator.clipboard.writeText(text);
      })
      .catch(() => {
        toast.error("Failed to copy markdown");
        setCopied(false);
      });
  }, [markdown, markdownUrl]);

  return (
    <div className="bg-secondary h-7.5 group/buttons relative flex rounded-sm gap-px p-0.5 select-none *:data-[slot=button]:focus-visible:relative *:data-[slot=button]:focus-visible:z-10">
      <Button
        variant="ghost"
        size="sm"
        className="bg-background h-full hover:bg-background! hover:border-primary/14 w-23.5 justify-start gap-1.5 rounded-xs border px-1.5! text-xs duration-0"
        onClick={onClick}
      >
        {copied ? <RiCheckLine className="size-3" /> : <RiFileCopyLine className="size-3" />}
        {copied ? "Copied" : "Copy page"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label="Open page markdown actions"
              className="h-full peer text-foreground/65 hover:text-primary rounded-xs w-6! hover:bg-transparent! aria-expanded:bg-transparent! focus-visible:ring-0!"
            />
          }
        >
          <RiArrowDownSLine className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={markdownUrl} target="_blank" rel="noreferrer" />}>
            <RiMarkdownLine className="size-3.5" />
            View as markdown
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/llms.txt" target="_blank" rel="noreferrer" />}>
            <RiExternalLinkLine className="size-3.5" />
            View llms.txt
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/llms-full.txt" target="_blank" rel="noreferrer" />}
          >
            <RiExternalLinkLine className="size-3.5" />
            View llms-full.txt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
