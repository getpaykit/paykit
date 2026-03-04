"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { LogoLockup } from "@/components/icons/logo";
import { useEarlyDevDialog } from "@/components/landing/early-dev-dialog";

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

export function NavigationBar() {
  const pathname = usePathname() || "/";
  const { open: openEarlyDevDialog } = useEarlyDevDialog();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = useCallback((href: string) => pathname === href, [pathname]);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[99] flex items-start pointer-events-none">
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
              onClick={() => setMobileMenuOpen((prev) => !prev)}
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
          className="relative w-full hidden lg:flex items-stretch justify-center border-b bg-background pointer-events-auto min-w-0"
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
                  const active = isActive(item.path || item.href);
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
                        className={`group/tab relative flex items-center justify-center gap-1.5 px-3.5 xl:px-5.5 py-3.5 h-full ${index < navFiles.length - 1 ? "border-r border-foreground/[0.06]" : ""} transition-colors duration-150 ${
                          active
                            ? "bg-background border-b-2 border-b-foreground/60"
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
                      isActive(item.path || item.href)
                        ? "bg-foreground/[0.04]"
                        : "hover:bg-foreground/[0.03]"
                    }`}
                  >
                    <span
                      className={`font-mono text-base uppercase tracking-wider ${
                        isActive(item.path || item.href)
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
