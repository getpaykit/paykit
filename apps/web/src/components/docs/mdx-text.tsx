"use client";

import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";
import { RiLinkM } from "react-icons/ri";

import { cn } from "@/lib/utils";

const linkDecorationClassName = "decoration-primary/50 group-hover:decoration-primary";
const linkIconClassName =
  "group-hover:text-primary text-muted-foreground mb-0.5 ml-px inline size-3 duration-100";

export function Anchor({ className, ...props }: ComponentProps<"a">) {
  return (
    <a {...props} className={cn(className, "group font-normal no-underline hover:text-primary")}>
      <span
        className={cn(
          "underline decoration-1 underline-offset-4 transition-colors duration-100 group-hover:text-primary",
          linkDecorationClassName,
        )}
      >
        {props.children}
      </span>
      <RiLinkM className={linkIconClassName} />
    </a>
  );
}

export function MDXLink({
  children,
  className,
  href,
  _blank,
}: {
  _blank?: boolean;
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      target={_blank ? "_blank" : "_self"}
      rel={_blank ? "noopener noreferrer" : undefined}
      className={cn(className, "group font-normal no-underline hover:text-primary")}
    >
      <span
        className={cn(
          "underline decoration-1 underline-offset-4 transition-colors duration-100 group-hover:text-primary",
          linkDecorationClassName,
        )}
      >
        {children}
      </span>
      <RiLinkM className={linkIconClassName} />
    </Link>
  );
}

export function InlineCode({ className, ...props }: ComponentProps<"code">) {
  return (
    <code
      {...props}
      className={cn(
        "bg-background text-foreground relative rounded-[5px] border border-foreground/15 px-[3px] py-px font-mono text-[0.75rem] outline-none",
        className,
      )}
    />
  );
}

export function Steps({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const steps = Children.toArray(children).filter((child) => isValidElement<StepProps>(child));

  return (
    <div
      className={cn(
        "steps relative mt-4 [&_h3]:mt-0! [&_h3]:pt-0.5 [&_h3]:text-[15px]! [&_h3]:font-medium [&_h3]:not-first:mt-2",
        className,
      )}
      {...props}
    >
      {steps.map((child, index) => {
        const step = child as React.ReactElement<StepProps>;
        const isFirstStep = index === 0;
        const isLastStep = index === steps.length - 1;

        return (
          <div key={index} className="relative">
            <div
              className={cn(
                "bg-border absolute top-[26px] left-[12px] h-full w-px",
                isLastStep && "from-border via-border/50 bg-gradient-to-b to-transparent",
              )}
              aria-hidden="true"
            />
            <div className="bg-border/85 text-primary absolute top-0.5 left-0 flex size-6 items-center justify-center rounded-full font-mono text-xs">
              {index + 1}
            </div>
            {cloneElement(step, {
              ...step.props,
              className: cn(step.props.className, "relative", isFirstStep && "mt-0"),
            })}
          </div>
        );
      })}
    </div>
  );
}

type StepProps = HTMLAttributes<HTMLDivElement>;

export function Step({ className, children, ...props }: StepProps) {
  return (
    <div className={cn("mt-6 pl-9", className)} {...props}>
      <div>{children}</div>
    </div>
  );
}

export function StepTitle({ className, children }: { children: string; className?: string }) {
  return (
    <h3 className={cn(className, "text-primary pt-0.5 text-[15px]! font-medium not-first:mt-2")}>
      {children}
    </h3>
  );
}

export function StepDescription({
  className,
  children,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        className,
        "text-muted-foreground text-sm font-normal not-first:mt-4 [&>p]:leading-relaxed",
      )}
    >
      {children}
    </div>
  );
}

export function StepContent({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn("flex flex-col gap-4 py-4", className)}>
      {children}
    </div>
  );
}
