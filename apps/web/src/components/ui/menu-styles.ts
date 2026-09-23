export const menuContentStyles =
  "z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-sm bg-popover p-0.5 text-foreground/75 shadow-md ring-1 ring-[color:color-mix(in_srgb,var(--foreground)_10%,var(--popover))] duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95";

export const menuItemStyles =
  "relative flex cursor-default items-center gap-1.5 rounded-xs min-h-6.75 px-1.5 py-0.5 text-sm text-foreground/75 outline-hidden select-none focus:bg-subtle-hover focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4";

export const menuLabelStyles =
  "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7";

export const menuSeparatorStyles = "-mx-0.5 my-0.5 h-px bg-border";

export const menuDestructiveItemStyles =
  "data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:[&_svg]:text-destructive";

export const menuSubTriggerStyles =
  "data-open:bg-subtle-hover data-open:text-accent-foreground data-popup-open:bg-subtle-hover data-popup-open:text-accent-foreground";
