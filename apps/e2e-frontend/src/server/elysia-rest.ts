import { Elysia } from "elysia";
import { PayKitError } from "paykitjs";
import * as z from "zod";

import { paykit } from "@/server/paykit";

const metadataSchema = z.record(z.string()).optional();

const createCustomerSchema = z.object({
  email: z.string().email().optional(),
  id: z.string().min(1),
  metadata: metadataSchema,
  name: z.string().min(1).optional(),
});

const customerIdSchema = z.object({
  id: z.string().min(1),
});

export const elysiaRest = new Elysia({
  prefix: "/api/rest/paykit",
})
  .post(
    "/customers",
    async ({ body }) => {
      return paykit.customers.create(body);
    },
    {
      body: createCustomerSchema,
    },
  )
  .get("/customers/:id", async ({ params }) => {
    return paykit.customers.get({ id: params.id });
  })
  .delete(
    "/customers/:id",
    async ({ body }) => {
      await paykit.customers.delete({ id: body.id });
      return { success: true };
    },
    {
      body: customerIdSchema,
    },
  )
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        code: "BAD_REQUEST",
        message: error.message,
      };
    }

    if (error instanceof PayKitError) {
      set.status = 400;
      return {
        code: error.code,
        message: error.message,
      };
    }

    set.status = 500;
    return {
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : "Unexpected server error",
    };
  });
