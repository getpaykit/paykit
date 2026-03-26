import { createPayKitClient } from "paykitjs/client";

import type { paykit } from "@/server/paykit";

export const paykitClient = createPayKitClient<typeof paykit>();
