import { createEndpoint, createMiddleware } from "better-call";

import type { PayKitContext } from "../core/context";

const paykitMiddleware = createMiddleware(async () => {
  return {} as PayKitContext;
});

export const createPayKitEndpoint: ReturnType<
  typeof createEndpoint.create<{ use: [typeof paykitMiddleware] }>
> = createEndpoint.create({
  use: [paykitMiddleware],
});
