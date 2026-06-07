import { cn } from "@/lib/utils";

export function FrameCorners({
  className,
  spanClassName,
  radius = "sm",
}: {
  className?: string;
  spanClassName?: string;
  radius?: "xs" | "sm";
}) {
  const rounded = {
    xs: ["rounded-tl-xs", "rounded-tr-xs", "rounded-bl-xs", "rounded-br-xs"],
    sm: ["rounded-tl-sm", "rounded-tr-sm", "rounded-bl-sm", "rounded-br-sm"],
  }[radius];

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 z-10", className)}>
      <span
        className={cn(
          "border-foreground/30 absolute top-0 left-0 size-2 border-t border-l",
          rounded[0],
          spanClassName,
        )}
      />
      <span
        className={cn(
          "border-foreground/30 absolute top-0 right-0 size-2 border-t border-r",
          rounded[1],
          spanClassName,
        )}
      />
      <span
        className={cn(
          "border-foreground/30 absolute bottom-0 left-0 size-2 border-b border-l",
          rounded[2],
          spanClassName,
        )}
      />
      <span
        className={cn(
          "border-foreground/30 absolute right-0 bottom-0 size-2 border-r border-b",
          rounded[3],
          spanClassName,
        )}
      />
    </div>
  );
}
