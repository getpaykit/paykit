"use client";

import { api } from "@/trpc/react";

export function CheckoutButton() {
  const createCheckout = api.paykit.createCheckout.useMutation();

  return (
    <div className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Checkout test</h2>
        <p className="text-sm text-white/70">
          This button calls the app&apos;s tRPC mutation, which syncs a demo customer and creates a
          PayKit checkout with the mock provider.
        </p>
      </div>

      <button
        type="button"
        className="rounded-full bg-white px-5 py-3 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/40"
        disabled={createCheckout.isPending}
        onClick={() => createCheckout.mutate()}
      >
        {createCheckout.isPending ? "Creating checkout..." : "Create checkout"}
      </button>

      {createCheckout.error ? (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {createCheckout.error.message}
        </p>
      ) : null}

      {createCheckout.data ? (
        <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
          <p>
            Checkout created for{" "}
            <span className="font-medium">{createCheckout.data.referenceId}</span>.
          </p>
          <a
            className="inline-flex break-all text-emerald-100 underline underline-offset-4"
            href={createCheckout.data.url}
            rel="noreferrer"
            target="_blank"
          >
            {createCheckout.data.url}
          </a>
        </div>
      ) : null}
    </div>
  );
}
