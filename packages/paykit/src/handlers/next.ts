import type { PayKitInstance } from "../types/instance";

export function paykitHandler(paykit: Pick<PayKitInstance, "handler">): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
} {
  return {
    GET: paykit.handler,
    POST: paykit.handler,
  };
}
