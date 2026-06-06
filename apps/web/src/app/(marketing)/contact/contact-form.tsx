"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActionState } from "react";
import { RiCheckLine, RiLoader4Line } from "react-icons/ri";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { submitContactForm } from "./actions";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { success?: boolean; error?: string } | null, formData: FormData) => {
      return submitContactForm(formData);
    },
    null,
  );

  return (
    <AnimatePresence mode="wait">
      {state?.success ? (
        <motion.div
          key="success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3 py-12 text-center"
        >
          <div className="bg-foreground/[0.05] flex size-10 items-center justify-center rounded-full">
            <RiCheckLine className="text-foreground/60 size-5" />
          </div>
          <p className="text-foreground/80 text-base font-medium">We received your message.</p>
          <p className="text-foreground/45 text-sm">We will get back to you as soon as possible.</p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          action={formAction}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" placeholder="Jane Doe" required className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="jane@company.com"
                required
                className="rounded-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              name="company"
              placeholder="Acme Inc."
              required
              className="rounded-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">How can we help?</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Tell us about your use case, team size, or any questions."
              rows={4}
              className="rounded-sm"
            />
          </div>

          {state?.error && <p className="text-destructive text-sm">{state.error}</p>}

          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? <RiLoader4Line className="size-4 animate-spin" /> : "Get in touch"}
          </Button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
