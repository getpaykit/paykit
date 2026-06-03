"use client";

import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import { RiMarkdownLine } from "react-icons/ri";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CopyMarkdownButton({ markdownUrl }: { markdownUrl: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    void fetch(markdownUrl)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.text();
      })
      .then((text) => navigator.clipboard.writeText(text))
      .catch(() => {
        toast.error("Failed to copy markdown");
        setCopied(false);
      });
  }, [markdownUrl]);

  return (
    <ButtonGroup>
      <Button variant="outline" size="sm" className="w-25 justify-start gap-1.5" onClick={onClick}>
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Copied" : "Copy page"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="Open page markdown actions" />
          }
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem render={<Link href={markdownUrl} target="_blank" rel="noreferrer" />}>
            <RiMarkdownLine className="size-3.5" />
            View as markdown
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/llms.txt" target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-3.5" />
            View llms.txt
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/llms-full.txt" target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-3.5" />
            View llms-full.txt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
