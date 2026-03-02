"use client";

import { motion } from "framer-motion";
import { Github, MoveRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { useEarlyDevDialog } from "./early-dev-dialog";
import { CodeExamplesSection, ServerClientTabs } from "./framework-sections";
import { TrustedBy } from "./trusted-by";

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
        "flex items-center border shrink-0 px-1.5 py-0.5 transition-all duration-300",
        dashed && "border-dashed",
        dot && "gap-1",
        c.box,
        className,
      )}
      style={style}
    >
      {dot && (
        <span className={cn("inline-block size-1 rounded-full", c.dot)} />
      )}
      {label && (
        <span className={cn("text-[10px] font-mono", c.text)}>{label}</span>
      )}
      {children}
    </div>
  );
}

const footerLinks = [{ label: "Author", href: "https://x.com/maxk4tz" }];

function ReadmeFooter() {
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  return (
    <div className="relative mt-10 pt-8 pb-0 overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
          opacity: 0.03,
        }}
      />

      {/* CTA */}
      <div className="relative">
        <p className="text-center text-base text-foreground/60 dark:text-foreground/50 tracking-tight">
          Roll your own auth with confidence in minutes.
        </p>

        <div className="flex items-center justify-center gap-4 mt-4">
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openEarlyDevDialog();
            }}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-foreground text-background text-xs font-mono uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            Read Docs
          </Link>
          <a
            href="https://github.com/getpaykit/paykit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-foreground/12 text-foreground/50 dark:text-foreground/40 hover:text-foreground/70 hover:border-foreground/25 text-xs font-mono uppercase tracking-wider transition-all"
          >
            <Github className="size-3.5" />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="relative mt-10 pt-6 border-t border-dashed border-foreground/6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {footerLinks.map((link, i) => (
              <span key={link.label} className="flex items-center">
                <Link
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1 text-xs font-mono text-foreground/35 hover:text-foreground/70 transition-colors"
                >
                  {link.label}
                </Link>
                {i < footerLinks.length - 1 && (
                  <span className="text-foreground/10 mx-1 text-xs select-none">
                    /
                  </span>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto sm:gap-4 shrink-0">
            <span className="text-xs text-foreground/35 dark:text-foreground/20 font-mono">
              © {new Date().getFullYear()} PayKit
            </span>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="text-foreground/10 select-none hidden sm:inline">
                ·
              </span>
              <Link
                href="https://x.com/getpaykit"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter/X"
                className="text-foreground/30 hover:text-foreground/60 transition-colors"
              >
                <Icons.XIcon className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="https://github.com/getpaykit/paykit"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="text-foreground/30 hover:text-foreground/60 transition-colors"
              >
                <Github className="h-4 w-4" />
              </Link>
              <div className="h-4 w-4 flex text-foreground/15 items-center justify-center select-none">
                |
              </div>
              <div className="-ml-4 sm:-ml-5">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroReadMe() {
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      className="flex flex-col w-full"
    >
      {/* Markdown content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-5 lg:p-5 pt-4 lg:pt-6 pb-0">
          <motion.article
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="overflow-y-auto overflow-x-hidden no-scrollbar pt-[30px] pb-0"
          >
            <h1 className="flex items-center gap-2 text-sm sm:text-base font-mono text-neutral-800 dark:text-neutral-200 pb-2 sm:pb-3 mb-4 sm:mb-5 border-b border-foreground/10">
              README
            </h1>

            <p className="text-sm sm:text-[15px] text-neutral-700 dark:text-neutral-300 leading-relaxed sm:leading-relaxed mb-5 sm:mb-6">
              PayKit is a payments orchestration framework for TypeScript. It
              sits between your app and payment providers like Stripe or PayPal,
              giving you a unified API. Webhooks are verified and normalized
              automatically. Your database owns the subscriptions, invoices, and
              usage records — no provider lock-in.
            </p>

            <div className="my-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs text-foreground/60 dark:text-foreground/40 font-mono tracking-wider uppercase shrink-0">
                  Configuration
                </span>
                <div className="flex-1 border-t border-foreground/[0.06]" />
              </div>
              <ServerClientTabs />
            </div>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 border-t border-foreground/6"></div>
              <span className="text-xs text-foreground/60 dark:text-foreground/40 font-mono tracking-wider uppercase shrink-0">
                Supported Providers
              </span>
            </div>

            <TrustedBy />

            <div className="flex items-center gap-3 my-4">
              <span className="text-xs text-foreground/60 dark:text-foreground/40 font-mono tracking-wider uppercase shrink-0">
                Features
              </span>
              <div className="flex-1 border-t border-foreground/6"></div>
            </div>

            <div className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mb-2 border border-foreground/10 overflow-hidden">
              {[
                {
                  label: "Unified API",
                  headline: "One API, every provider.",
                  desc: "Stripe, PayPal, and regional PSPs behind a single TypeScript interface. Swap providers with config, not rewrites.",
                  providers: true,
                  href: "#",
                },
                {
                  label: "Subscriptions",
                  headline: "Provider-native, unified.",
                  desc: "Create, cancel, pause, resume — using each provider's own billing engine behind one consistent API.",
                  subscriptions: true,
                  href: "#",
                },
                {
                  label: "Checkout",
                  headline: "Payments in minutes.",
                  desc: "One-time payments, hosted checkout. Pass an amount and description — no product catalog needed.",
                  checkout: true,
                  href: "#",
                },
                {
                  label: "Webhook Engine",
                  headline: "Normalized events.",
                  desc: "Stripe's invoice.payment_failed and PayPal's BILLING.SUBSCRIPTION.PAYMENT.FAILED both become one typed event.",
                  webhooks: true,
                  href: "#",
                },
                {
                  label: "Your Database",
                  headline: "You own the state.",
                  desc: "Prisma and Drizzle adapters sync everything to your DB. Business logic reads from your tables, not provider APIs.",
                  database: true,
                  href: "#",
                },
                {
                  label: "Type-Safe",
                  headline: "End-to-end types.",
                  desc: "Zod-validated inputs, typed events, plugin endpoints that merge into paykit.api.* automatically.",
                  typesafe: true,
                  href: "#",
                },
              ].map((feature, i) => (
                <Link
                  key={feature.label}
                  href={"href" in feature ? feature.href : "#"}
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
                      "group/card relative p-4 lg:p-5 border-foreground/[0.1] min-h-[180px] transition-all duration-200 hover:bg-foreground/[0.02] hover:shadow-[inset_0_1px_0_0_rgba(128,128,128,0.1)] hover:z-10",
                      // Bottom border: all except last row (3x2: last row starts at 3)
                      i < 5 && "border-b",
                      i >= 3 && "md:border-b-0",
                      // Right border: 2-col layout
                      i % 2 === 0 && i < 5 && "sm:border-r",
                      // 3-col: right border except on 3rd column
                      i % 3 !== 2 && "md:border-r",
                      i % 2 !== 0 && i % 3 === 2 && "md:border-r-0",
                    )}
                  >
                    {/* Arrow icon — top right, visible on hover */}
                    <span className="absolute top-3 right-3 lg:top-4 lg:right-4 opacity-0 -translate-y-0.5 group-hover/card:opacity-100 group-hover/card:translate-y-0 transition-all duration-200">
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
                    <div className="text-xs font-mono text-neutral-500 mb-2 uppercase tracking-wider transition-colors duration-200 group-hover/card:text-neutral-400 dark:group-hover/card:text-neutral-400">
                      <span className="text-foreground/35 dark:text-foreground/20 mr-1.5 transition-colors duration-200 group-hover/card:text-foreground/50 dark:group-hover/card:text-foreground/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {feature.label}
                    </div>
                    <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-snug mb-1.5 transition-colors duration-200 group-hover/card:text-neutral-900 dark:group-hover/card:text-neutral-100">
                      {feature.headline}
                    </div>
                    <div className="text-xs text-neutral-500 leading-relaxed transition-colors duration-200 group-hover/card:text-neutral-400 dark:group-hover/card:text-neutral-400">
                      {feature.desc}
                    </div>
                    {"providers" in feature && feature.providers && (
                      <div className="flex items-center gap-2.5 mt-3">
                        {/* Stripe */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          className="text-[#635BFF] opacity-60 transition-all duration-300 group-hover/card:opacity-100 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0s]"
                        >
                          <path
                            fill="currentColor"
                            d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409c0-.831.683-1.305 1.901-1.305c2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0C9.667 0 7.589.654 6.104 1.872C4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219c2.585.92 3.445 1.574 3.445 2.583c0 .98-.84 1.545-2.354 1.545c-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813c1.664-1.305 2.525-3.236 2.525-5.732c0-4.128-2.524-5.851-6.594-7.305z"
                          />
                        </svg>
                        {/* PayPal */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="0 0 154.728 190.5"
                          className="opacity-60 transition-all duration-300 group-hover/card:opacity-100 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.05s]"
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
                        {/* Polar */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="-0.5 -0.5 16 16"
                          fill="none"
                          className="text-neutral-800 dark:text-neutral-200 opacity-60 transition-all duration-300 group-hover/card:opacity-100 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.1s]"
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
                        {/* LemonSqueezy */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          className="text-[#FFC333] opacity-60 transition-all duration-300 group-hover/card:opacity-100 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.15s]"
                        >
                          <path
                            fill="currentColor"
                            d="m7.4916 10.835 2.3748-6.5114a3.1497 3.1497 0 0 0-.065-2.3418C9.0315.183 6.9427-.398 5.2928.265 3.643.929 2.71 2.4348 3.512 4.3046l2.8197 6.5615c.219.509.97.489 1.16-.03m1.6798 1.0969 6.5334-2.7758c2.1699-.9219 2.7218-3.6907 1.022-5.2905l-.068-.063c-1.6669-1.5469-4.4217-1.002-5.3706 1.0359L8.3566 11.135c-.234.503.295 1.0199.8159.7979m.373.87 6.6454-2.5119c2.2078-.8349 4.6206.745 4.5886 3.0398l-.002.09c-.048 2.2358-2.3938 3.7376-4.5536 2.9467l-6.6724-2.4418a.595.595 0 0 1-.006-1.1229m-.386 1.9269 6.4375 2.9767a3.2997 3.2997 0 0 1 1.6658 1.6989c.769 1.7998-.283 3.6396-1.9328 4.3016-1.6499.662-3.4097.235-4.2097-1.6359l-2.8027-6.5694c-.217-.509.328-1.009.8419-.772"
                          />
                        </svg>
                        {/* Paddle */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="15"
                          height="15"
                          viewBox="0 0 160 201"
                          className="text-neutral-800 dark:text-neutral-200 opacity-60 transition-all duration-300 group-hover/card:opacity-100 group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.2s]"
                        >
                          <path
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M32.154 10.694V21.113l34.575.751c33.315.724 34.94.966 44.623 6.66 32.453 19.077 29.294 71.09-5.193 85.472-5.992 2.5-15.922 3.3-40.958 3.3H32.154v41.49 41.49h11.702 11.702v-30.632-30.632l26.064-.855c22.107-.726 27.679-1.634 36.703-5.991 15.017-7.254 29.536-22.83 35.153-37.716 9.43-24.991 2.627-55.38-16.353-73.051C118.533 4.09 105.065.275 62.559.275H32.154v10.42zm0 26.143c0 1.387-1.915 6.477-4.255 11.311-4.213 8.704-16.779 18.085-24.226 18.085-2.015 0-3.434 1.757-3.434 4.255 0 2.87 1.42 4.255 4.362 4.255 11.183 0 23.508 11.673 26.394 24.999 2.155 9.95 5.853 8.496 10.734-4.219 4.59-11.957 14.662-20.78 23.719-20.78 3.585 0 5.004-1.207 5.004-4.256 0-2.498-1.42-4.255-3.434-4.255-7.447 0-20.013-9.381-24.226-18.085-2.34-4.834-4.255-9.923-4.255-11.31 0-1.386-1.436-2.52-3.191-2.52s-3.192 1.134-3.192 2.52z"
                          />
                        </svg>
                        {/* +more */}
                        <FeaturePill
                          dashed
                          label="+ Custom"
                          className="justify-center h-[20px] group-hover/card:animate-[icon-bounce_0.4s_ease-out_0.25s]"
                        />
                      </div>
                    )}
                    {"checkout" in feature && feature.checkout && (
                      <div
                        className="mt-3 flex items-center gap-1.5 text-[10px]"
                        style={{
                          fontFamily:
                            "var(--font-mono), Geist Mono, ui-monospace, monospace",
                        }}
                      >
                        <FeaturePill className="h-5 px-2 overflow-hidden">
                          <span className="text-foreground/35 whitespace-nowrap">
                            pk.checkout({"{"}{" "}
                            <span className="text-emerald-600/60 dark:text-emerald-400/50">
                              amount
                            </span>
                            :{" "}
                            <span className="text-orange-500/60 dark:text-orange-400/50">
                              990
                            </span>{" "}
                            {"}"})
                          </span>
                        </FeaturePill>
                        <MoveRight
                          className="text-foreground/20 shrink-0"
                          size={10}
                        />
                        <FeaturePill color="blue" className="h-5 px-2 gap-1.5">
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
                            className="text-blue-500/50 dark:text-blue-400/40 shrink-0"
                          >
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          <span className="text-blue-500/50 dark:text-blue-400/40">
                            URL
                          </span>
                        </FeaturePill>
                      </div>
                    )}
                    {"subscriptions" in feature && feature.subscriptions && (
                      <div className="mt-3 flex items-center gap-1.5 relative overflow-hidden">
                        <FeaturePill color="blue" dot label="trialing" />
                        <MoveRight
                          className="text-foreground/20 shrink-0"
                          size={10}
                        />
                        <FeaturePill color="green" dot label="active" />
                        <MoveRight
                          className="text-foreground/20 shrink-0"
                          size={10}
                        />
                        <FeaturePill color="yellow" dot label="past_due" />
                        <MoveRight
                          className="text-foreground/20 shrink-0"
                          size={10}
                        />
                        <FeaturePill color="red" dot label="canceled" />
                        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
                      </div>
                    )}
                    {"database" in feature && feature.database && (
                      <div className="mt-3 flex items-center gap-1 font-mono text-[10px]">
                        <FeaturePill label="prisma" className="px-1.5 py-0.5" />
                        <FeaturePill label="drizzle" />
                        <FeaturePill
                          dashed
                          label="+"
                          className="justify-center size-[22px]"
                        />
                      </div>
                    )}
                    {"typesafe" in feature && feature.typesafe && (
                      <FeaturePill
                        className="mt-3 inline-flex h-5 px-2.5 text-[10px] w-fit"
                        style={{
                          fontFamily:
                            "var(--font-mono), Geist Mono, ui-monospace, monospace",
                        }}
                      >
                        <span className="text-blue-500/50 dark:text-blue-400/40">
                          PayKitEvent
                        </span>
                        <span className="text-foreground/35">{"<"}</span>
                        <span className="text-orange-500/60 dark:text-orange-400/50">
                          "payment.failed"
                        </span>
                        <span className="text-foreground/35">{">"}</span>
                      </FeaturePill>
                    )}
                    {"webhooks" in feature && feature.webhooks && (
                      <div className="mt-3 flex items-center gap-1.5 text-[10px]">
                        <FeaturePill className="h-5 px-2">
                          <span className="text-foreground/35">
                            billing.invoice.failed*
                          </span>
                        </FeaturePill>
                        <MoveRight
                          className="text-foreground/20 shrink-0"
                          size={10}
                        />
                        <FeaturePill color="green" className="h-5 px-2">
                          <span className="text-green-600/60 dark:text-green-400/50">
                            payment.failed
                          </span>
                        </FeaturePill>
                      </div>
                    )}
                  </motion.div>
                </Link>
              ))}
              {/* + marks at grid intersections */}
              <span className="hidden md:block absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 font-mono -mt-[1px] -ml-[.5px] text-xs text-foreground/35 dark:text-foreground/20 select-none z-10">
                +
              </span>
              <span className="hidden md:block absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 font-mono -mt-[1px] -ml-[.5px] text-xs text-foreground/35 dark:text-foreground/20 select-none z-10">
                +
              </span>
            </div>

            {/* Code Examples */}
            <div className="my-8">
              <CodeExamplesSection />
            </div>

            <ReadmeFooter />
          </motion.article>
        </div>
      </div>
    </motion.div>
  );
}
