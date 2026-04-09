import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import type { PayKitInstance } from "paykitjs";

type AuthWithSession = {
  api: {
    getSession: (opts: {
      headers: HeadersInit;
    }) => Promise<{ user: { id: string; email: string; name: string | null } } | null>;
  };
};

export function paykitPlugin(paykit: PayKitInstance): BetterAuthPlugin {
  return {
    id: "paykit",
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === "/sign-up/email" || ctx.path === "/sign-up/social",
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (!returned || typeof returned !== "object" || !("user" in returned)) return;
            const { user } = returned as {
              user: { id: string; email: string; name: string | null };
            };
            await paykit.upsertCustomer({
              id: user.id,
              email: user.email ?? undefined,
              name: user.name ?? undefined,
            });
          }),
        },
      ],
    },
  };
}

export function paykitIdentify(auth: AuthWithSession) {
  return async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;
    return {
      customerId: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
    };
  };
}
