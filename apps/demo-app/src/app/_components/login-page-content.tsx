"use client";

import { redirect, useSearchParams } from "next/navigation";

import { AuthForm } from "@/app/_components/auth-form";
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
          <p className="text-sm tracking-widest text-white/50 uppercase">PayKit Demo</p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Checking your session...
        </div>
      </div>
    );
  }

  if (session) {
    redirect(redirectTo);
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm tracking-widest text-white/50 uppercase">PayKit Demo</p>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-white/70">
          Authentication is handled separately so the main route can stay focused on checkout.
        </p>
      </div>
      <AuthForm redirectTo={redirectTo} />
    </div>
  );
}
