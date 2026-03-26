import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { auth } from "@/server/auth";
import { pool } from "@/server/db";
import { paykit } from "@/server/paykit";

export const paykitRouter = createTRPCRouter({
  currentPlans: publicProcedure.query(async ({ ctx }) => {
    const session = await auth.api.getSession({ headers: ctx.headers });
    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    await paykit.ensureCustomer({
      email: session.user.email,
      id: session.user.id,
      name: session.user.name ?? undefined,
    });

    const result = await pool.query<{
      amount: number | null;
      canceled: boolean;
      currentPeriodEndAt: Date | null;
      id: string;
      interval: string | null;
      name: string;
      startedAt: Date | null;
      status: string;
    }>(
      `
      select
        p.id,
        p.name,
        cp.status,
        cp.canceled,
        cp.started_at as "startedAt",
        cp.current_period_end_at as "currentPeriodEndAt",
        pr.amount,
        pr.interval
      from paykit_customer_product cp
      inner join paykit_product p on p.internal_id = cp.product_internal_id
      left join paykit_price pr on pr.product_internal_id = p.internal_id
      where cp.customer_id = $1
        and (cp.ended_at is null or cp.ended_at > now() or cp.status = 'scheduled')
      order by cp.created_at desc
    `,
      [session.user.id],
    );

    return result.rows;
  }),

  checkFeature: publicProcedure
    .input(z.object({ featureId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return paykit.check({
        customerId: session.user.id,
        featureId: input.featureId,
      });
    }),

  reportUsage: publicProcedure
    .input(z.object({ amount: z.number().int().min(1).optional(), featureId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await auth.api.getSession({ headers: ctx.headers });
      if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return paykit.report({
        amount: input.amount,
        customerId: session.user.id,
        featureId: input.featureId,
      });
    }),
});
