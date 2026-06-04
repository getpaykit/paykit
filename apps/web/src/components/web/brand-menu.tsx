"use client";

import Link from "next/link";
import { useRef } from "react";
import { RiCodeSSlashLine } from "react-icons/ri";
import { toast } from "sonner";

import { LOGO_SVG, Logo } from "@/components/icons/logo";
import { WORDMARK_SVG, Wordmark } from "@/components/icons/wordmark";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

type BrandAsset = "Logo" | "Wordmark";

const brandAssets = {
  Logo: LOGO_SVG,
  Wordmark: WORDMARK_SVG,
};

export function BrandMenu({
  className,
  linkClassName,
  wordmarkBaseClassName,
  wordmarkClassName,
}: {
  className?: string;
  linkClassName?: string;
  wordmarkBaseClassName?: string;
  wordmarkClassName?: string;
}) {
  const logoRef = useRef<HTMLAnchorElement>(null);

  async function copyAsSvg(asset: BrandAsset) {
    try {
      await navigator.clipboard.writeText(brandAssets[asset]);
      toast.success(`${asset} SVG code copied to clipboard.`, {
        icon: <RiCodeSSlashLine className="size-4" />,
      });
    } catch {
      toast.error("Failed to copy to clipboard.");
    }
  }

  return (
    <div className={cn("z-10 flex items-center", className)}>
      <ContextMenu>
        <ContextMenuTrigger
          className="flex items-center"
          render={
            <Link
              ref={logoRef}
              href="/"
              aria-label="PayKit home"
              className={cn("flex items-center py-1.5", linkClassName)}
            >
              <Wordmark
                title={null}
                className={cn(wordmarkBaseClassName ?? "h-4", wordmarkClassName)}
              />
            </Link>
          }
        />

        <ContextMenuContent
          anchor={logoRef}
          align="start"
          alignOffset={0}
          side="bottom"
          sideOffset={4}
          positionerClassName="z-100"
        >
          <ContextMenuItem className="px-3" onClick={() => copyAsSvg("Logo")}>
            <Logo className="text-muted-foreground" /> Copy logo as SVG
          </ContextMenuItem>
          <ContextMenuItem className="px-3" onClick={() => copyAsSvg("Wordmark")}>
            <RiCodeSSlashLine className="text-muted-foreground" /> Copy wordmark as SVG
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
