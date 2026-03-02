"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { LogoLockup } from "../icons/logo";
import { contents } from "../sidebar-content";
import { Badge } from "../ui/badge";
import { useEarlyDevDialog } from "./early-dev-dialog";

interface NavFileItem {
  name: string;
  href: string;
  path?: string;
  external?: boolean;
}

const navFiles: NavFileItem[] = [
  { name: "readme", href: "/" },
  { name: "docs", href: "#" },
  {
    name: "github",
    href: "https://github.com/getpaykit/paykit",
    external: true,
  },
];

export function StaggeredNavFiles() {
  const pathname = usePathname() || "/";
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"docs" | "nav">("docs");
  const [mobileDocSection, setMobileDocSection] = useState(-1);

  const isActive = useCallback((href: string) => pathname === href, [pathname]);
  const isDocs = pathname.startsWith("/docs");
  const isNarrowLeft = isDocs;
  const navBottomBorderClass = isNarrowLeft ? "border-foreground/5" : "";
  const tabDividerClass = isNarrowLeft
    ? "border-foreground/4"
    : "border-foreground/[0.06]";
  const activeTabBorderClass = isNarrowLeft
    ? "border-b-foreground/50"
    : "border-b-foreground/60";
  const _router = useRouter();
  return (
    <>
      <div className="absolute top-0 left-0 right-0 z-[99] flex items-start pointer-events-none">
        {/* Left — Logo */}

        {/* Mobile — Logo + hamburger */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="lg:hidden flex items-center justify-between w-full pointer-events-auto bg-background border-b border-foreground/[0.06]"
        >
          <Link
            href="/"
            className="flex items-center gap-1 px-4 py-3 transition-colors duration-150"
          >
            <LogoLockup className="h-4" />
          </Link>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                const opening = !mobileMenuOpen;
                setMobileMenuOpen(opening);
                if (opening) {
                  setMobileView(isDocs ? "docs" : "nav");
                  if (isDocs) {
                    const idx = contents.findIndex((s) =>
                      s.list.some(
                        (l) =>
                          l.href === pathname ||
                          (l.hasSubpages && pathname.startsWith(`${l.href}/`)),
                      ),
                    );
                    setMobileDocSection(idx === -1 ? 0 : idx);
                  }
                }
              }}
              className="flex items-center justify-center px-4 py-3 text-foreground/65 dark:text-foreground/50 hover:text-foreground/80 transition-colors"
            >
              {mobileMenuOpen ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="currentColor"
                    d="M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z"
                  />
                </svg>
              )}
            </button>
          </div>
        </motion.div>

        {/* Right — Nav tabs (desktop) */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, delay: 0.04, ease: "easeOut" }}
          className={`relative w-full hidden lg:flex items-stretch justify-center border-b bg-background pointer-events-auto min-w-0 ${navBottomBorderClass}`}
        >
          <div className="relative flex items-stretch w-full max-w-[60rem]">
            {/* Logo */}
            <Link
              href="/"
              className="relative z-10 flex items-center gap-1 px-4 lg:px-5 py-3.5 shrink-0 transition-colors duration-150"
            >
              <LogoLockup className="h-5" />
            </Link>
            {/* File tabs — centered within container */}
            <div className="absolute inset-0 flex items-stretch justify-center pointer-events-none">
              <div className="flex items-stretch pointer-events-auto">
                {navFiles.map((item, index) => {
                  const active =
                    isActive(item.path || item.href) ||
                    (item.href === "/docs" && isDocs);
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: 0.05 + index * 0.03,
                        ease: "easeOut",
                      }}
                    >
                      <Link
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noreferrer" : undefined}
                        onClick={
                          item.href === "#"
                            ? (e) => {
                                e.preventDefault();
                                openEarlyDevDialog();
                              }
                            : undefined
                        }
                        className={`group/tab relative flex items-center justify-center gap-1.5 px-3.5 xl:px-5.5 py-3.5 h-full ${index < navFiles.length - 1 ? `border-r ${tabDividerClass}` : ""} transition-colors duration-150 ${
                          active
                            ? `bg-background border-b-2 ${activeTabBorderClass}`
                            : "bg-transparent hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <span
                          className={`font-mono text-sm uppercase tracking-wider transition-colors duration-150 whitespace-nowrap ${
                            active
                              ? "text-foreground"
                              : "text-foreground/60 dark:text-foreground/40 group-hover/tab:text-foreground/70"
                          }`}
                        >
                          {item.name}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="lg:hidden fixed inset-0 z-[98] bg-background/95 backdrop-blur-sm pointer-events-auto"
          >
            <div className="pt-[52px] flex flex-col h-full overflow-y-auto">
              {isDocs && mobileView === "docs" ? (
                <>
                  {/* Subtle back to nav button */}
                  <button
                    type="button"
                    onClick={() => setMobileView("nav")}
                    className="flex items-center gap-2 px-5 py-2.5 text-foreground/55 dark:text-foreground/35 hover:text-foreground/60 transition-colors border-b border-foreground/[0.06]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fill="currentColor"
                        d="M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z"
                      />
                    </svg>
                    <span className="font-mono text-xs uppercase tracking-wider">
                      Menu
                    </span>
                  </button>

                  {/* Doc sidebar sections */}
                  <MotionConfig
                    transition={{ duration: 0.35, type: "spring", bounce: 0 }}
                  >
                    <div className="flex flex-col">
                      {contents.map((section, index) => (
                        <div key={section.title}>
                          <button
                            type="button"
                            className={cn(
                              "border-b border-foreground/6 w-full text-left flex gap-2 items-center px-5 py-3 transition-colors",
                              "font-medium text-base tracking-wider",
                              mobileDocSection === index
                                ? "text-foreground bg-foreground/3"
                                : "text-foreground/65 hover:text-foreground hover:bg-foreground/3",
                            )}
                            onClick={() =>
                              setMobileDocSection((prev) =>
                                prev === index ? -1 : index,
                              )
                            }
                          >
                            <section.Icon className="size-4.5" />
                            <span className="grow">{section.title}</span>
                            <ChevronDownIcon
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                mobileDocSection === index ? "rotate-180" : "",
                              )}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {mobileDocSection === index && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="relative overflow-hidden"
                              >
                                <div className="text-sm pt-0 pb-1">
                                  {section.href && (
                                    <Link
                                      href={section.href}
                                      onClick={() => setMobileMenuOpen(false)}
                                      data-active={
                                        pathname === section.href || undefined
                                      }
                                      className={cn(
                                        "relative flex items-center gap-2.5 px-5 py-1.5 text-sm transition-all duration-150",
                                        pathname === section.href
                                          ? "text-foreground bg-foreground/6"
                                          : "text-foreground/70 dark:text-foreground/55 hover:text-foreground/85 hover:bg-foreground/3",
                                      )}
                                    >
                                      <span className="truncate">Overview</span>
                                    </Link>
                                  )}
                                  {section.list.map((item, i) => {
                                    if (item.separator || item.group) {
                                      return (
                                        <div
                                          key={`sep-${item.title}-${i}`}
                                          className="flex flex-row items-center gap-2 mx-5 my-2"
                                        >
                                          <p className="text-xs text-foreground/55 dark:text-foreground/35 uppercase tracking-wider">
                                            {item.title}
                                          </p>
                                          <div className="grow h-px bg-border" />
                                        </div>
                                      );
                                    }
                                    if (!item.href) return null;
                                    const active =
                                      pathname === item.href ||
                                      (!!item.hasSubpages &&
                                        pathname.startsWith(`${item.href}/`));
                                    return (
                                      <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        data-active={active || undefined}
                                        className={cn(
                                          "relative flex items-center gap-2.5 px-5 py-1.5 text-sm transition-all duration-150",
                                          active
                                            ? "text-foreground bg-foreground/6"
                                            : "text-foreground/70 dark:text-foreground/55 hover:text-foreground/85 hover:bg-foreground/3",
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            "min-w-5 [&>svg]:size-[14px] transition-colors duration-150",
                                            active
                                              ? "text-foreground"
                                              : "text-foreground/70 dark:text-foreground/55",
                                          )}
                                        >
                                          <item.icon className="text-foreground/75" />
                                        </span>
                                        <span className="truncate grow">
                                          {item.title}
                                        </span>
                                        {item.isNew && (
                                          <Badge
                                            className={cn(
                                              "pointer-events-none border-dashed rounded-none px-1.5 py-0 text-xs uppercase tracking-wider",
                                              active
                                                ? "border-solid bg-foreground/10 text-foreground"
                                                : "text-foreground/65 dark:text-foreground/50 border-foreground/20",
                                            )}
                                            variant="outline"
                                          >
                                            New
                                          </Badge>
                                        )}
                                      </Link>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </MotionConfig>
                </>
              ) : (
                <>
                  {/* Back to docs button (when on docs page and switched to nav view) */}
                  {isDocs && mobileView === "nav" && (
                    <button
                      type="button"
                      onClick={() => setMobileView("docs")}
                      className="flex items-center gap-2 px-5 py-2.5 text-foreground/55 dark:text-foreground/35 hover:text-foreground/60 transition-colors border-b border-foreground/[0.06]"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          d="M20 11H7.83l5.59-5.59L12 4l-8 8l8 8l1.41-1.41L7.83 13H20z"
                        />
                      </svg>
                      <span className="font-mono text-xs uppercase tracking-wider">
                        Docs
                      </span>
                    </button>
                  )}

                  {/* Default nav items */}
                  {navFiles.map((item, i) => (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                    >
                      <Link
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noreferrer" : undefined}
                        onClick={(e) => {
                          if (item.href === "#") {
                            e.preventDefault();
                            setMobileMenuOpen(false);
                            openEarlyDevDialog();
                          } else {
                            setMobileMenuOpen(false);
                          }
                        }}
                        className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-foreground/[0.06] transition-colors ${
                          isActive(item.path || item.href) ||
                          (item.href === "/docs" && isDocs)
                            ? "bg-foreground/[0.04]"
                            : "hover:bg-foreground/[0.03]"
                        }`}
                      >
                        <span
                          className={`font-mono text-base uppercase tracking-wider ${
                            isActive(item.path || item.href) ||
                            (item.href === "/docs" && isDocs)
                              ? "text-foreground"
                              : "text-foreground/65 dark:text-foreground/50"
                          }`}
                        >
                          {item.name}
                        </span>
                        {item.external && (
                          <svg
                            className="h-2.5 w-2.5 text-foreground/35 dark:text-foreground/20 ml-auto"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M1 9L9 1M9 1H3M9 1V7"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </svg>
                        )}
                      </Link>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
