"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

interface CopyButtonProps {
  code: string;
}

function CopyButton({ code }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      className="flex h-6 w-6 items-center justify-center rounded-md border-none bg-transparent transition-colors hover:bg-white/[0.06]"
      aria-label="Copy code"
    >
      {copied ? (
        <HugeiconsIcon
          icon={Tick02Icon}
          size={14}
          className="text-emerald-400"
        />
      ) : (
        <HugeiconsIcon
          icon={Copy01Icon}
          size={14}
          className="text-muted-foreground"
        />
      )}
    </button>
  );
}

export { CopyButton };
