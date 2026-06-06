import { cn } from "@/lib/utils";

export function FrameCorners({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <span className="border-foreground/35 absolute top-0 left-0 size-2 border-t border-l" />
      <span className="border-foreground/35 absolute top-0 right-0 size-2 border-t border-r" />
      <span className="border-foreground/35 absolute bottom-0 left-0 size-2 border-b border-l" />
      <span className="border-foreground/35 absolute right-0 bottom-0 size-2 border-r border-b" />
    </div>
  );
}
