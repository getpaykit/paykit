import { TRPCError } from "@trpc/server";
import type { CheckResult, CustomerWithDetails, PayKitOptions, ReportResult } from "paykitjs";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

type DemoPayKit<TFeatureId extends string> = {
  $infer: { featureId: TFeatureId };
  options: Pick<PayKitOptions, "stripe">;
  check(input: {
    customerId: string;
    featureId: TFeatureId;
    required?: number;
  }): Promise<CheckResult>;
  deleteCustomer(input: { id: string }): Promise<unknown>;
  getCustomer(input: { id: string }): Promise<CustomerWithDetails | null>;
  report(input: {
    amount?: number;
    customerId: string;
    featureId: TFeatureId;
  }): Promise<ReportResult>;
  upsertCustomer(input: { email?: string; id: string; name?: string }): Promise<unknown>;
};

export function createPaykitRouter<const TFeatureId extends string>(
  getPaykit: () => DemoPayKit<TFeatureId> | null,
) {
  function requirePaykit() {
    const paykit = getPaykit();
    if (!paykit) {
      throw new TRPCError({ code: "NOT_FOUND", message: "PayKit is not configured" });
    }
    return paykit;
  }

  return createTRPCRouter({
    createCustomer: publicProcedure.mutation(async ({ ctx }) => {
      const paykit = requirePaykit();
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      return paykit.upsertCustomer({
        email: session.user.email,
        id: session.user.id,
        name: session.user.name ?? undefined,
      });
    }),

    deleteCustomer: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx }) => {
        const paykit = requirePaykit();
        const session = await auth.api.getSession({ headers: ctx.headers });
        if (!session) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          });
        }

        return paykit.deleteCustomer({ id: session.user.id });
      }),

    currentPlans: publicProcedure.query(async ({ ctx }) => {
      const paykit = requirePaykit();
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      await paykit.upsertCustomer({
        email: session.user.email,
        id: session.user.id,
        name: session.user.name ?? undefined,
      });

      const customer = await paykit.getCustomer({ id: session.user.id });
      return customer?.subscriptions ?? [];
    }),

    checkFeature: publicProcedure
      .input(z.object({ featureId: z.string() }))
      .query(async ({ ctx, input }) => {
        const paykit = requirePaykit();
        const session = await auth.api.getSession({ headers: ctx.headers });
        if (!session) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return paykit.check({
          customerId: session.user.id,
          featureId: input.featureId as TFeatureId,
        });
      }),

    reportUsage: publicProcedure
      .input(z.object({ amount: z.number().int().min(1).optional(), featureId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const paykit = requirePaykit();
        const session = await auth.api.getSession({ headers: ctx.headers });
        if (!session) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        return paykit.report({
          amount: input.amount,
          customerId: session.user.id,
          featureId: input.featureId as TFeatureId,
        });
      }),
  });
}
