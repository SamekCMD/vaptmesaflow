import { createAuthClient } from "better-auth/react";
import { ENV } from "@/lib/env";

export const authClient = createAuthClient({
  baseURL: ENV.vaptApiBaseUrl,
  fetchOptions: { credentials: "include" },
});
