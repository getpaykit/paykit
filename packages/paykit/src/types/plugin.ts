import type { NormalizedPlan } from "./schema";

export interface BeforeSubscribeHookCtx {
  readonly customerId: string;
  readonly plan: NormalizedPlan;
  readonly customerEmail?: string;
  /** Optional client metadata.
   * Note: IP is currently not passed by the core service.
   */
  readonly ip?: string;
}

export interface PayKitPlugin {
  id: string;
  /**
   * Better-call endpoints to merge into the PayKit router.
   * Paths are relative to the API base path (e.g. "/dash/stats" → "/paykit/api/dash/stats").
   */
  endpoints?: Record<string, unknown>;
  onBeforeSubscribe?: (hookCtx: BeforeSubscribeHookCtx) => Promise<void>;
}
