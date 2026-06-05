"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RiArrowDownSLine, RiCloseLine, RiExternalLinkLine, RiMenuLine } from "react-icons/ri";

import { Icons } from "@/components/icons";
import { SectionShell } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { BrandMenu } from "@/components/web/brand-menu";
import { URLs } from "@/lib/consts";

// ─── Shared nav link ─────────────────────────────────────────────────

interface NavItem {
  name: string;
  href: string;
  path?: string;
  external?: boolean;
  icon?: React.ReactNode;
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
      onClick={() => {
        onClick?.();
      }}
    >
      {children}
    </Link>
  );
}

// ─── Data ────────────────────────────────────────────────────────────

const navTabs: NavItem[] = [
  { name: "docs", href: "/docs", path: "/docs" },
  { name: "blog", href: "/blog", path: "/blog" },
  { name: "sponsors", href: "/sponsor", path: "/sponsor" },
];

const dropdownLinks: NavItem[] = [
  {
    name: "Discord",
    href: URLs.discord,
    external: true,
    icon: <Icons.DiscordIcon className="size-4" />,
  },
  { name: "Twitter / X", href: URLs.x, external: true, icon: <Icons.XIcon className="size-3.5" /> },
  {
    name: "LinkedIn",
    href: URLs.linkedin,
    external: true,
    icon: <Icons.LinkedInIcon className="size-3.5" />,
  },
  {
    name: "llms.txt",
    href: "/llms.txt",
    external: true,
    icon: <Icons.LlmsIcon className="size-4" />,
  },
];

const mobileLinks: NavItem[] = [
  ...navTabs,
  ...dropdownLinks.map((l) => ({ ...l, name: l.name.toLowerCase() })),
];

// ─── Tab styles ──────────────────────────────────────────────────────

const tabBase =
  "group/tab relative flex h-full items-center justify-center gap-1.5 px-4 py-3.5 transition-colors duration-150";
const tabActive = "bg-background";
const tabInactive =
  "hover:bg-foreground/[0.03] bg-transparent text-foreground/60 dark:text-foreground/40 hover:text-foreground/70";
const labelBase =
  "text-sm tracking-wider whitespace-nowrap uppercase transition-colors duration-150";

// ─── Component ───────────────────────────────────────────────────────

export function NavigationBar({ stars: _stars }: { stars: number | null }) {
  const routerPathname = usePathname();
  const [pathname, setPathname] = useState("/");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (routerPathname) setPathname(routerPathname);
  }, [routerPathname]);
  const [linksOpen, setLinksOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isActive = (href: string) =>
    href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const openLinks = useCallback(() => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current);
    setLinksOpen(true);
  }, []);

  const closeLinks = useCallback(() => {
    closeTimeout.current = setTimeout(() => setLinksOpen(false), 150);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed top-0 right-0 left-0 z-99 flex items-start [scrollbar-gutter:stable]">
        {/* Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="bg-background pointer-events-auto w-full lg:hidden"
        >
          <SectionShell className="border-border border-b">
            <div className="flex w-full items-center justify-between pl-2.5">
              <BrandMenu linkClassName="rounded-sm px-2.5 py-2 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors" />
              <button
                type="button"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-controls="mobile-navigation-menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="text-foreground/65 dark:text-foreground/50 hover:text-foreground/80 px-5 py-3 transition-colors"
              >
                {mobileMenuOpen ? <RiCloseLine size={18} /> : <RiMenuLine size={18} />}
              </button>
            </div>
          </SectionShell>
        </motion.div>

        {/* Desktop */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, delay: 0.04, ease: "easeOut" }}
          className="bg-background pointer-events-auto relative hidden w-full items-stretch justify-center lg:flex"
        >
          <SectionShell className="border-border border-b">
            <div className="flex h-12 items-center justify-between px-12">
              {/* Logo */}
              <BrandMenu linkClassName="-ml-2.5 rounded-sm px-2.5 py-2 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors" />

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
                          className={`${tabBase} ${active ? tabActive : tabInactive}`}
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
                      <RiArrowDownSLine
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
                          className="bg-background border-foreground/8 absolute top-full left-1/2 z-50 mt-px min-w-45 -translate-x-1/2 border py-1 shadow-lg"
                        >
                          {dropdownLinks.map((link) => (
                            <NavLink
                              key={link.name}
                              item={link}
                              className="text-foreground/60 hover:text-foreground hover:bg-foreground/3 flex items-center justify-between px-4 py-2 text-sm transition-colors"
                              onClick={() => setLinksOpen(false)}
                            >
                              <span className="flex items-center gap-2.5">
                                <span className="text-foreground/35 flex size-4 items-center justify-center">
                                  {link.icon}
                                </span>
                                {link.name}
                              </span>
                              <RiExternalLinkLine className="text-foreground/20 size-3" />
                            </NavLink>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>

              {/* Right */}
              <div className="relative z-10 flex items-center gap-0.">
                <Button
                  render={<Link href={URLs.githubRepo} target="_blank" rel="noopener noreferrer" />}
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  className="px-2 -mr-2"
                >
                  <Icons.GitHubIcon className="size-4.5" />
                  <span className="font-sans text-sm">1k</span>
                </Button>
              </div>
            </div>
          </SectionShell>
        </motion.div>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-navigation-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-background/95 pointer-events-auto fixed inset-0 z-98 backdrop-blur-sm lg:hidden"
          >
            <div className="flex h-full flex-col overflow-y-auto pt-13">
              {mobileLinks.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                >
                  <NavLink
                    item={item}
                    className={`flex items-center gap-2.5 px-5 py-3.5 transition-colors ${
                      isActive(item.path || item.href) ? "bg-foreground/4" : "hover:bg-foreground/3"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.icon && (
                      <span className="text-foreground/35 dark:text-foreground/25 flex size-4 items-center justify-center">
                        {item.icon}
                      </span>
                    )}
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
                      <RiExternalLinkLine className="text-foreground/35 dark:text-foreground/20 ml-auto size-3" />
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
