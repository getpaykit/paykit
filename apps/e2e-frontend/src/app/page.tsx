import { CheckoutButton } from "@/app/_components/checkout-button";
import { HydrateClient } from "@/trpc/server";

export default function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          <div className="space-y-3">
            <p className="text-sm tracking-[0.3em] text-white/50 uppercase">PayKit E2E frontend</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Trigger checkout through tRPC
            </h1>
            <p className="max-w-2xl text-base text-white/70">
              Use this page to exercise the Next.js to tRPC to PayKit checkout path against a mock
              provider during development.
            </p>
          </div>

          <CheckoutButton />
        </div>
      </main>
    </HydrateClient>
  );
}
