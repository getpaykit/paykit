import { createPayKitClient } from "paykitjs/client";

import type { PayKitInstance } from "@/lib/paykit";

type ClientInstance<T> = T & { options: T extends { options: infer TOptions } ? TOptions : never };

export const paykitClient = createPayKitClient<ClientInstance<PayKitInstance>>({
  baseURL: "/paykit",
});
