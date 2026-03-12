"use client";

import { motion } from "framer-motion";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CreemIcon } from "@/components/icons/creem";
import { cn } from "@/lib/utils";

import { useEarlyDevDialog } from "../landing/early-dev-dialog";
import { featureCards, type FeatureVariant } from "./features-content";
import { ProvidersSection } from "./providers-section";

const pillColors = {
  neutral: {
    box: "border-foreground/[0.06] bg-foreground/[0.015] group-hover/card:border-foreground/[0.12] group-hover/card:bg-foreground/[0.03]",
    dot: "",
    text: "text-foreground/35",
  },
  blue: {
    box: "border-blue-400/17 bg-blue-400/3 group-hover/card:border-blue-400/30 group-hover/card:bg-blue-400/[0.06]",
    dot: "bg-blue-400/50",
    text: "text-blue-400/60",
  },
  green: {
    box: "border-green-400/15 bg-green-400/[0.03] group-hover/card:border-green-400/25 group-hover/card:bg-green-400/[0.06]",
    dot: "bg-green-400/50",
    text: "text-green-400/50",
  },
  yellow: {
    box: "border-yellow-500/15 bg-yellow-500/[0.03] group-hover/card:border-yellow-500/25 group-hover/card:bg-yellow-500/[0.06]",
    dot: "bg-yellow-500/40",
    text: "text-yellow-500/50",
  },
  red: {
    box: "border-red-400/15 bg-red-400/[0.03] group-hover/card:border-red-400/25 group-hover/card:bg-red-400/[0.06]",
    dot: "bg-red-400/40",
    text: "text-red-400/40",
  },
} as const;

function FeaturePill({
  color = "neutral",
  dot,
  dashed,
  label,
  className,
  style,
  children,
}: {
  color?: keyof typeof pillColors;
  dot?: boolean;
  dashed?: boolean;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}) {
  const c = pillColors[color];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center border px-1.5 py-0.5 transition-all duration-300",
        dashed && "border-dashed",
        dot && "gap-1",
        c.box,
        className,
      )}
      style={style}
    >
      {dot && <span className={cn("inline-block size-1 rounded-full", c.dot)} />}
      {label && <span className={cn("font-mono text-[10px]", c.text)}>{label}</span>}
      {children}
    </div>
  );
}

function FeatureVariantContent({ variant }: { variant: FeatureVariant }) {
  if (variant === "providers") {
    return (
      <div className="mt-3 flex items-center gap-2.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          className="text-[#635BFF] opacity-60 transition-all duration-300 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0s] group-hover/card:opacity-100"
        >
          <path
            fill="currentColor"
            d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409c0-.831.683-1.305 1.901-1.305c2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0C9.667 0 7.589.654 6.104 1.872C4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219c2.585.92 3.445 1.574 3.445 2.583c0 .98-.84 1.545-2.354 1.545c-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813c1.664-1.305 2.525-3.236 2.525-5.732c0-4.128-2.524-5.851-6.594-7.305z"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 154.728 190.5"
          className="opacity-60 transition-all duration-300 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.05s] group-hover/card:opacity-100"
        >
          <g transform="translate(898.192 276.071)">
            <path
              d="M-837.663-237.968a5.49 5.49 0 0 0-5.423 4.633l-9.013 57.15-8.281 52.514-.005.044.01-.044 8.281-52.514c.421-2.669 2.719-4.633 5.42-4.633h26.404c26.573 0 49.127-19.387 53.246-45.658.314-1.996.482-3.973.52-5.924v-.003h-.003c-6.753-3.543-14.683-5.565-23.372-5.565z"
              fill="#001c64"
            />
            <path
              d="M-766.506-232.402c-.037 1.951-.207 3.93-.52 5.926-4.119 26.271-26.673 45.658-53.246 45.658h-26.404c-2.701 0-4.999 1.964-5.42 4.633l-8.281 52.514-5.197 32.947a4.46 4.46 0 0 0 4.405 5.153h28.66a5.49 5.49 0 0 0 5.423-4.633l7.55-47.881c.423-2.669 2.722-4.636 5.423-4.636h16.876c26.573 0 49.124-19.386 53.243-45.655 2.924-18.649-6.46-35.614-22.511-44.026z"
              fill="#0070e0"
            />
            <path
              d="M-870.225-276.071a5.49 5.49 0 0 0-5.423 4.636l-22.489 142.608a4.46 4.46 0 0 0 4.405 5.156h33.351l8.281-52.514 9.013-57.15a5.49 5.49 0 0 1 5.423-4.633h47.782c8.691 0 16.621 2.025 23.375 5.563.46-23.917-19.275-43.666-46.412-43.666z"
              fill="#003087"
            />
          </g>
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="-0.5 -0.5 16 16"
          fill="none"
          className="text-neutral-800 opacity-60 transition-all duration-300 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.1s] group-hover/card:opacity-100 dark:text-neutral-200"
        >
          <path
            d="M7.5 14.337c-3.776 0-6.837-3.061-6.837-6.837C.663 3.724 3.724.663 7.5.663c3.776 0 6.837 3.061 6.837 6.837 0 3.776-3.061 6.837-6.837 6.837Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
          />
          <path
            d="M7.5 14.337c-1.51 0-2.735-3.061-2.735-6.837C4.765 3.724 5.99.663 7.5.663c1.51 0 2.735 3.061 2.735 6.837 0 3.776-1.225 6.837-2.735 6.837Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
          />
          <path
            d="M5.449 13.654c-2.051-.684-2.735-3.685-2.735-5.812 0-2.127 1.026-4.786 3.419-6.495"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
          />
          <path
            d="M9.551 1.346c2.051.684 2.735 3.685 2.735 5.812 0 2.127-1.026 4.786-3.419 6.495"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          className="text-[#FFC333] opacity-60 transition-all duration-300 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.15s] group-hover/card:opacity-100"
        >
          <path
            fill="currentColor"
            d="m7.4916 10.835 2.3748-6.5114a3.1497 3.1497 0 0 0-.065-2.3418C9.0315.183 6.9427-.398 5.2928.265 3.643.929 2.71 2.4348 3.512 4.3046l2.8197 6.5615c.219.509.97.489 1.16-.03m1.6798 1.0969 6.5334-2.7758c2.1699-.9219 2.7218-3.6907 1.022-5.2905l-.068-.063c-1.6669-1.5469-4.4217-1.002-5.3706 1.0359L8.3566 11.135c-.234.503.295 1.0199.8159.7979m.373.87 6.6454-2.5119c2.2078-.8349 4.6206.745 4.5886 3.0398l-.002.09c-.048 2.2358-2.3938 3.7376-4.5536 2.9467l-6.6724-2.4418a.595.595 0 0 1-.006-1.1229m-.386 1.9269 6.4375 2.9767a3.2997 3.2997 0 0 1 1.6658 1.6989c.769 1.7998-.283 3.6396-1.9328 4.3016-1.6499.662-3.4097.235-4.2097-1.6359l-2.8027-6.5694c-.217-.509.328-1.009.8419-.772"
          />
        </svg>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 160 201"
          className="text-neutral-800 opacity-60 transition-all duration-300 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.2s] group-hover/card:opacity-100 dark:text-neutral-200"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M32.154 10.694V21.113l34.575.751c33.315.724 34.94.966 44.623 6.66 32.453 19.077 29.294 71.09-5.193 85.472-5.992 2.5-15.922 3.3-40.958 3.3H32.154v41.49 41.49h11.702 11.702v-30.632-30.632l26.064-.855c22.107-.726 27.679-1.634 36.703-5.991 15.017-7.254 29.536-22.83 35.153-37.716 9.43-24.991 2.627-55.38-16.353-73.051C118.533 4.09 105.065.275 62.559.275H32.154v10.42zm0 26.143c0 1.387-1.915 6.477-4.255 11.311-4.213 8.704-16.779 18.085-24.226 18.085-2.015 0-3.434 1.757-3.434 4.255 0 2.87 1.42 4.255 4.362 4.255 11.183 0 23.508 11.673 26.394 24.999 2.155 9.95 5.853 8.496 10.734-4.219 4.59-11.957 14.662-20.78 23.719-20.78 3.585 0 5.004-1.207 5.004-4.256 0-2.498-1.42-4.255-3.434-4.255-7.447 0-20.013-9.381-24.226-18.085-2.34-4.834-4.255-9.923-4.255-11.31 0-1.386-1.436-2.52-3.191-2.52s-3.192 1.134-3.192 2.52z"
          />
        </svg>
        <CreemIcon
          width={15}
          height={15}
          className="opacity-60 transition-all duration-300 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.25s] group-hover/card:opacity-100"
        />
        <FeaturePill
          dashed
          label="+ Custom"
          className="h-[20px] justify-center group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.3s]"
        />
      </div>
    );
  }

  if (variant === "checkout") {
    return (
      <div
        className="mt-3 flex items-center gap-1.5 text-[10px]"
        style={{
          fontFamily: "var(--font-mono), Geist Mono, ui-monospace, monospace",
        }}
      >
        <FeaturePill className="h-5 overflow-hidden px-2">
          <span className="text-foreground/35 whitespace-nowrap">
            pk.checkout({"{"}{" "}
            <span className="text-emerald-600/60 dark:text-emerald-400/50">amount</span>:
            <span className="text-orange-500/60 dark:text-orange-400/50"> 990</span> {"}"})
          </span>
        </FeaturePill>
        <MoveRight className="text-foreground/20 shrink-0" size={10} />
        <FeaturePill color="blue" className="h-5 gap-1.5 px-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-blue-500/50 dark:text-blue-400/40"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="text-blue-500/50 dark:text-blue-400/40">URL</span>
        </FeaturePill>
      </div>
    );
  }

  if (variant === "subscriptions") {
    return (
      <div className="relative mt-3 flex items-center gap-1.5 overflow-hidden">
        <FeaturePill color="blue" dot label="trialing" />
        <MoveRight className="text-foreground/20 shrink-0" size={10} />
        <FeaturePill color="green" dot label="active" />
        <MoveRight className="text-foreground/20 shrink-0" size={10} />
        <FeaturePill color="yellow" dot label="past_due" />
        <MoveRight className="text-foreground/20 shrink-0" size={10} />
        <FeaturePill color="red" dot label="canceled" />
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent" />
      </div>
    );
  }

  if (variant === "database") {
    return (
      <div className="mt-3 flex items-center gap-1 font-mono text-[10px]">
        <FeaturePill label="prisma" className="px-1.5 py-0.5" />
        <FeaturePill label="drizzle" />
        <FeaturePill dashed label="+" className="size-[22px] justify-center" />
      </div>
    );
  }

  if (variant === "typesafe") {
    return (
      <FeaturePill
        className="mt-3 inline-flex h-5 w-fit px-2.5 text-[10px]"
        style={{
          fontFamily: "var(--font-mono), Geist Mono, ui-monospace, monospace",
        }}
      >
        <span className="text-blue-500/50 dark:text-blue-400/40">PayKitEvent</span>
        <span className="text-foreground/35">{"<"}</span>
        <span className="text-orange-500/60 dark:text-orange-400/50">"payment.failed"</span>
        <span className="text-foreground/35">{">"}</span>
      </FeaturePill>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-1.5 text-[10px]">
      <FeaturePill className="h-5 px-2">
        <span className="text-foreground/35">billing.invoice.failed*</span>
      </FeaturePill>
      <MoveRight className="text-foreground/20 shrink-0" size={10} />
      <FeaturePill color="green" className="h-5 px-2">
        <span className="text-green-600/60 dark:text-green-400/50">payment.failed</span>
      </FeaturePill>
    </div>
  );
}

export function FeaturesSection() {
  const { open: openEarlyDevDialog } = useEarlyDevDialog();

  return (
    <>
      <div className="my-4 flex items-center gap-3">
        <div className="border-foreground/6 flex-1 border-t" />
        <span className="text-foreground/60 dark:text-foreground/40 shrink-0 font-mono text-xs tracking-wider uppercase">
          Supported Providers
        </span>
      </div>

      <ProvidersSection />

      <div className="my-4 flex items-center gap-3">
        <span className="text-foreground/60 dark:text-foreground/40 shrink-0 font-mono text-xs tracking-wider uppercase">
          Features
        </span>
        <div className="border-foreground/6 flex-1 border-t" />
      </div>

      <div className="border-foreground/10 relative mb-2 grid grid-cols-1 overflow-hidden border sm:grid-cols-2 md:grid-cols-3">
        {featureCards.map((feature, i) => (
          <Link
            key={feature.label}
            href={feature.href}
            onClick={(e) => {
              e.preventDefault();
              openEarlyDevDialog();
            }}
            className="contents"
          >
            <motion.div
              whileHover={{
                y: -2,
                transition: { duration: 0.2, ease: "easeOut" },
              }}
              className={cn(
                "group/card border-foreground/[0.1] relative min-h-[180px] p-4 transition-all duration-200 hover:z-10 hover:bg-foreground/[0.02] hover:shadow-[inset_0_1px_0_0_rgba(128,128,128,0.1)] lg:p-5",
                i < 5 && "border-b",
                i >= 4 && "sm:border-b-0",
                i < 3 ? "md:border-b" : "md:border-b-0",
                i % 2 === 0 && i < 5 && "sm:border-r",
                i % 3 !== 2 ? "md:border-r" : "md:border-r-0",
              )}
            >
              <span className="absolute top-3 right-3 -translate-y-0.5 opacity-0 transition-all duration-200 group-hover/card:translate-y-0 group-hover/card:opacity-100 lg:top-4 lg:right-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-foreground/40 dark:text-foreground/50"
                >
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </span>
              <div className="mb-2 font-mono text-xs tracking-wider text-neutral-500 uppercase transition-colors duration-200 group-hover/card:text-neutral-400 dark:group-hover/card:text-neutral-400">
                <span className="text-foreground/35 dark:text-foreground/20 group-hover/card:text-foreground/50 dark:group-hover/card:text-foreground/30 mr-1.5 transition-colors duration-200">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {feature.label}
              </div>
              <div className="mb-1.5 text-sm leading-snug font-semibold text-neutral-800 transition-colors duration-200 group-hover/card:text-neutral-900 dark:text-neutral-200 dark:group-hover/card:text-neutral-100">
                {feature.headline}
              </div>
              <div className="text-xs leading-relaxed text-neutral-500 transition-colors duration-200 group-hover/card:text-neutral-400 dark:group-hover/card:text-neutral-400">
                {feature.desc}
              </div>
              <FeatureVariantContent variant={feature.variant} />
            </motion.div>
          </Link>
        ))}
        <span className="text-foreground/35 dark:text-foreground/20 absolute top-1/2 left-1/3 z-10 -mt-[1px] -ml-[.5px] hidden -translate-x-1/2 -translate-y-1/2 font-mono text-xs select-none md:block">
          +
        </span>
        <span className="text-foreground/35 dark:text-foreground/20 absolute top-1/2 left-2/3 z-10 -mt-[1px] -ml-[.5px] hidden -translate-x-1/2 -translate-y-1/2 font-mono text-xs select-none md:block">
          +
        </span>
      </div>
    </>
  );
}
