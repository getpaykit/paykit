"use client";

import { redirect, useSearchParams } from "next/navigation";

import { AuthForm } from "@/app/_components/auth-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

function getSafeRedirectPath(redirectTo: string | null) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/";
  }

  return redirectTo;
}

export function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectPath(searchParams.get("redirect"));
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm tracking-widest uppercase">PayKit Demo</p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        </div>
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session) {
    redirect(redirectTo);
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">PayKit Demo</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Authentication is handled separately so the main route can stay focused on billing.
        </p>
      </div>
      <AuthForm redirectTo={redirectTo} />
    </div>
  );
}
