import { paykitHandler } from "paykitjs/handlers/next";

import { paykit } from "@/server/paykit";

export const { GET, POST } = paykitHandler(paykit);
