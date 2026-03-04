"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useDocsSearch } from "fumadocs-core/search/client";
import { FileText, Hash, Search, Text } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ─── Context ─────────────────────────────────────────────────────────────────

type CommandMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu() {
  const ctx = use(CommandMenuContext);
  if (!ctx) throw new Error("useCommandMenu must be used within CommandMenuProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandMenuContext value={value}>
      {children}
      <CommandMenuDialog />
    </CommandMenuContext>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

function CommandMenuDialog() {
  const { open, setOpen } = useCommandMenu();
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        setTimeout(() => {
          setSearchQuery("");
        }, 200);
      }
    },
    [setOpen],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/50"
            onClick={() => handleOpenChange(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleOpenChange(false);
            }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[20%] left-[50%] z-[201] w-full max-w-[640px] translate-x-[-50%] px-4 sm:px-0"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                handleOpenChange(false);
              }
            }}
          >
            <div className="border-foreground/[0.08] bg-background flex max-h-[min(500px,60vh)] flex-col overflow-hidden border font-mono shadow-2xl">
              <SearchMode
                query={searchQuery}
                setQuery={setSearchQuery}
                onClose={() => handleOpenChange(false)}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Search Mode ─────────────────────────────────────────────────────────────

function SearchMode({
  query,
  setQuery,
  onClose,
}: {
  query: string;
  setQuery: (q: string) => void;
  onClose: () => void;
}) {
  const {
    search: _search,
    setSearch,
    query: results,
  } = useDocsSearch({
    type: "fetch",
    api: "/api/search",
  });
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Sync external query with search
  useEffect(() => {
    setSearch(query);
  }, [query, setSearch]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = results.data !== "empty" ? (results.data ?? []) : [];

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && items[selectedIndex]) {
      e.preventDefault();
      router.push(items[selectedIndex].url);
      onClose();
    }
  };

  return (
    <>
      {/* Input */}
      <div className="border-foreground/[0.06] flex items-center border-b px-3">
        <Search className="text-muted-foreground mr-2 size-4 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search documentation..."
          className="placeholder:text-muted-foreground flex h-11 w-full bg-transparent py-3 font-mono text-sm outline-none"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-1">
        {results.isLoading && (
          <div className="text-muted-foreground py-6 text-center text-sm">Searching...</div>
        )}
        {!results.isLoading && query && items.length === 0 && (
          <div className="text-muted-foreground py-6 text-center text-sm">No results found.</div>
        )}
        {!results.isLoading && !query && (
          <div className="text-muted-foreground py-6 text-center text-sm">
            Type to search documentation...
          </div>
        )}
        {items.map((item, index) => {
          const isNested = item.type === "heading" || item.type === "text";
          const pageName = (item as any).pageName as string | undefined;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "group flex w-full items-center gap-2 px-2 py-1.5 text-sm text-left transition-colors",
                isNested && "pl-5",
                index === selectedIndex
                  ? "bg-foreground/[0.04] text-foreground"
                  : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
              )}
              onClick={() => {
                router.push(item.url);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {item.type === "heading" ? (
                <Hash className="size-3.5 shrink-0 opacity-50" />
              ) : item.type === "text" ? (
                <Text className="size-3.5 shrink-0 opacity-50" />
              ) : (
                <FileText className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {item.content}
                {isNested && pageName && (
                  <span
                    className={cn(
                      "ml-1.5 transition-colors",
                      index === selectedIndex
                        ? "text-foreground/80"
                        : "text-muted-foreground/60 group-hover:text-foreground/80",
                    )}
                  >
                    in {pageName}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-foreground/[0.06] text-muted-foreground flex items-center justify-between border-t px-3 py-1.5 text-xs">
        <div className="flex gap-2">
          <span>
            <kbd className="border-foreground/[0.08] border px-1 py-0.5">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="border-foreground/[0.08] border px-1 py-0.5">↵</kbd> open
          </span>
          <span>
            <kbd className="border-foreground/[0.08] border px-1 py-0.5">esc</kbd> close
          </span>
        </div>
      </div>
    </>
  );
}
