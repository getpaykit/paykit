import { paykit } from "@/lib/paykit";
import { getConfiguredScenarios } from "@/lib/scenario-config";
import { autumnRouter } from "@/server/api/routers/autumn";
import { createPaykitRouter } from "@/server/api/routers/paykit-route";
import { postRouter } from "@/server/api/routers/post";
import { createCallerFactory, createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  autumn: autumnRouter,
  paykit: createPaykitRouter(() => paykit),
  post: postRouter,
  scenarios: createTRPCRouter({
    list: publicProcedure.query(() => getConfiguredScenarios()),
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
