export interface BeforeSubscribeHookCtx {
  readonly customerId: string;
  readonly planId: string;
  readonly ip?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
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
