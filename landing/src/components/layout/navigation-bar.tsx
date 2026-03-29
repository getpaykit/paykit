"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Github, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { LogoLockup } from "@/components/icons/logo";
import { DashedLine } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { URLs } from "@/lib/consts";

// ─── Shared nav link ─────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  path?: string;
  external?: boolean;
}

function NavLink({
  item,
  className,
  children,
  onClick,
}: {
  item: NavItem;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

// ─── Data ────────────────────────────────────────────────────────────

const navTabs: NavItem[] = [
  { name: "readme", href: "/" },
  { name: "docs", href: "/docs", path: "/docs" },
  { name: "enterprise", href: "/enterprise", path: "/enterprise" },
];

const dropdownLinks: NavItem[] = [
  { name: "Discord", href: URLs.discord, external: true },
  { name: "Twitter / X", href: URLs.x, external: true },
  { name: "LinkedIn", href: URLs.linkedin, external: true },
];

const mobileLinks: NavItem[] = [
  ...navTabs,
  ...dropdownLinks.map((l) => ({ ...l, name: l.name.toLowerCase() })),
];

// ─── Tab styles ──────────────────────────────────────────────────────

const tabBase =
  "group/tab relative flex h-full items-center justify-center gap-1.5 px-3.5 py-3.5 xl:px-5.5 transition-colors duration-150";
const tabActive = "bg-background border-b-foreground/60 border-b-2";
const tabInactive =
  "hover:bg-foreground/[0.03] bg-transparent text-foreground/60 dark:text-foreground/40 hover:text-foreground/70";
const labelBase =
  "text-sm tracking-wider whitespace-nowrap uppercase transition-colors duration-150";

// ─── Component ───────────────────────────────────────────────────────

export function NavigationBar({ stars }: { stars: number | null }) {
  const pathname = usePathname() || "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isActive = useCallback(
    (href: string) =>
      href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  const openLinks = useCallback(() => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setLinksOpen(true);
  }, []);

  const closeLinks = useCallback(() => {
    closeTimeout.current = setTimeout(() => setLinksOpen(false), 150);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed top-0 right-0 left-0 z-[99] flex items-start">
        {/* Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="bg-background border-foreground/[0.06] pointer-events-auto flex w-full items-center justify-between border-b lg:hidden"
        >
          <Link href="/" className="flex items-center gap-1 px-4 py-3">
            <LogoLockup className="h-4" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="text-foreground/65 dark:text-foreground/50 hover:text-foreground/80 px-4 py-3 transition-colors"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </motion.div>

        {/* Desktop */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, delay: 0.04, ease: "easeOut" }}
          className="bg-background pointer-events-auto relative hidden w-full items-stretch justify-center border-b lg:flex"
        >
          <div className="relative mx-auto w-full max-w-[76rem]">
            <DashedLine orientation="vertical" />
            <div className="absolute top-0 right-0 h-full">
              <DashedLine orientation="vertical" />
            </div>
            <div className="flex items-stretch justify-between px-12">
              {/* Logo */}
              <Link href="/" className="relative z-10 flex shrink-0 items-center py-3.5">
                <LogoLockup className="h-5" />
              </Link>

              {/* Center tabs */}
              <div className="absolute inset-0 flex items-stretch justify-center">
                <div className="flex items-stretch">
                  {navTabs.map((item, i) => {
                    const active = isActive(item.path || item.href);
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 + i * 0.03, ease: "easeOut" }}
                      >
                        <NavLink
                          item={item}
                          className={`${tabBase} border-foreground/[0.06] border-r ${active ? tabActive : tabInactive}`}
                        >
                          <span className={`${labelBase} ${active ? "text-foreground" : ""}`}>
                            {item.name}
                          </span>
                        </NavLink>
                      </motion.div>
                    );
                  })}

                  {/* Links dropdown */}
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: 0.05 + navTabs.length * 0.03,
                      ease: "easeOut",
                    }}
                    className="relative"
                    onMouseEnter={openLinks}
                    onMouseLeave={closeLinks}
                  >
                    <button
                      type="button"
                      className={`${tabBase} gap-1 ${linksOpen ? "text-foreground/70" : tabInactive}`}
                    >
                      <span className={`${labelBase}`}>links</span>
                      <ChevronDown
                        className={`size-3 transition-transform duration-150 ${linksOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {linksOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className="bg-background border-foreground/[0.08] absolute top-full left-1/2 z-50 mt-px min-w-[180px] -translate-x-1/2 border py-1 shadow-lg"
                        >
                          {dropdownLinks.map((link) => (
                            <NavLink
                              key={link.name}
                              item={link}
                              className="text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03] flex items-center justify-between px-4 py-2 text-sm transition-colors"
                              onClick={() => setLinksOpen(false)}
                            >
                              {link.name}
                              {link.external && (
                                <ExternalLink className="text-foreground/20 size-3" />
                              )}
                            </NavLink>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>

              {/* Right */}
              <div className="relative z-10 flex items-center gap-2">
                <Button
                  render={<Link href={URLs.githubRepo} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                  variant={"outline"}
                  size="sm"
                >
                  <Github className="size-3.5" />
                  {stars !== null && <span>Star on GitHub!</span>}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-background/95 pointer-events-auto fixed inset-0 z-[98] backdrop-blur-sm lg:hidden"
          >
            <div className="flex h-full flex-col overflow-y-auto pt-[52px]">
              {mobileLinks.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                >
                  <NavLink
                    item={item}
                    className={`border-foreground/[0.06] flex items-center gap-2.5 border-b px-5 py-3.5 transition-colors ${
                      isActive(item.path || item.href)
                        ? "bg-foreground/[0.04]"
                        : "hover:bg-foreground/[0.03]"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span
                      className={`text-base tracking-wider uppercase ${
                        isActive(item.path || item.href)
                          ? "text-foreground"
                          : "text-foreground/65 dark:text-foreground/50"
                      }`}
                    >
                      {item.name}
                    </span>
                    {item.external && (
                      <ExternalLink className="text-foreground/35 dark:text-foreground/20 ml-auto size-3" />
                    )}
                  </NavLink>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
