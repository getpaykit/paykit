"use client";

import { Github, Star } from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EarlyDevDialogContext {
  open: () => void;
}

const EarlyDevDialogContext = createContext<EarlyDevDialogContext | null>(null);

export function useEarlyDevDialog() {
  const ctx = useContext(EarlyDevDialogContext);
  if (!ctx) {
    throw new Error("useEarlyDevDialog must be used within EarlyDevProvider");
  }
  return ctx;
}

export function EarlyDevProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <EarlyDevDialogContext.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Coming Soon
            </DialogTitle>
            <DialogDescription>
              PayKit is in early development. Documentation and guides are being
              written — star us on GitHub to follow along.
            </DialogDescription>
          </DialogHeader>
          <a
            href="https://github.com/getpaykit/paykit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            <Github className="size-4" />
            Star on GitHub
            <Star className="size-3.5" />
          </a>
        </DialogContent>
      </Dialog>
    </EarlyDevDialogContext.Provider>
  );
}
