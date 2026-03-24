"use client";

import { useMutation } from "@tanstack/react-query";

import { paykitClient } from "@/lib/paykit-client";

type CheckoutProductId = Parameters<typeof paykitClient.checkout>[0]["productId"];

export function CheckoutPanel() {
  const checkout = useMutation({
    mutationFn: async ({ productId }: { productId: CheckoutProductId }) => {
      const result = await paykitClient.checkout({
        productId,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/checkout/cancel`,
      });

      return { productId, url: result.url };
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  const errorMessage =
    checkout.error instanceof Error
      ? checkout.error.message
      : checkout.error
        ? "Checkout failed"
        : "";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Checkout</h2>
      <p className="text-sm text-white/70">
        These use the PayKit client SDK and send the request with your authenticated session.
      </p>
      <div className="flex gap-3">
        <button
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold transition hover:bg-emerald-500 disabled:opacity-50"
          disabled={checkout.isPending}
          onClick={() => checkout.mutate({ productId: "starter_pack" })}
          type="button"
        >
          {checkout.isPending ? "Redirecting..." : "Starter Pack - $9.90"}
        </button>
        <button
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold transition hover:bg-indigo-500 disabled:opacity-50"
          disabled={checkout.isPending}
          onClick={() => checkout.mutate({ productId: "pro_monthly" })}
          type="button"
        >
          {checkout.isPending ? "Redirecting..." : "Pro Monthly - $19.90/mo"}
        </button>
      </div>
      {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
    </div>
  );
}
