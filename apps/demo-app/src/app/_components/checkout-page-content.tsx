"use client";

import { redirect, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { FeaturesPanel } from "@/app/_components/features-panel";
import { SubscribePanel } from "@/app/_components/subscribe-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

export function CheckoutPageContent() {
  const { data: session, error, isPending } = authClient.useSession();
  const searchParams = useSearchParams();
  const toastShown = useRef(false);

  useEffect(() => {
    if (toastShown.current) return;
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toastShown.current = true;
      toast.success("Billing flow completed successfully");
    } else if (checkout === "canceled") {
      toastShown.current = true;
      toast.warning("Billing flow was canceled");
    }
  }, [searchParams]);

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!session || error) {
    redirect("/login?redirect=%2F");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Manage your subscription and billing details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{session.user.email}</span>
          <Button
            onClick={() => {
              void authClient.signOut();
            }}
            size="sm"
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </div>
      <Separator />
      <SubscribePanel />
      <Separator />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Features</h2>
        <FeaturesPanel />
      </section>
    </div>
  );
}
