"use client";

import { redirect } from "next/navigation";

import { CheckoutPanel } from "@/app/_components/checkout-panel";
import { authClient } from "@/lib/auth-client";

export function CheckoutPageContent() {
  const { data: session, error, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex w-full max-w-lg flex-col gap-6">
        <div className="space-y-2">
          <p className="text-sm tracking-widest text-white/50 uppercase">PayKit Demo</p>
          <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Loading your session...
        </div>
      </div>
    );
  }

  if (!session || error) {
    redirect("/login?redirect=%2F");
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm tracking-widest text-white/50 uppercase">PayKit Demo</p>
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-white/70">Authentication lives on a dedicated login route.</p>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex-1">
          <p className="text-sm text-white/70">Signed in as</p>
          <p className="font-medium">{session.user.email}</p>
        </div>
        <button
          className="rounded-full border border-white/10 px-4 py-2 text-sm transition hover:bg-white/10"
          onClick={() => {
            void authClient.signOut();
          }}
          type="button"
        >
          Sign out
        </button>
      </div>
      <CheckoutPanel />
    </div>
  );
}
