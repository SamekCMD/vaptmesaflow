import type { RequestCheckTableSessionDto } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

export function requestTableCheck(
  sessionId: string,
  publicOrderId: string,
  publicOrderToken: string,
): Promise<RequestCheckTableSessionDto> {
  if (!publicOrderId || !publicOrderToken) {
    return Promise.reject(new Error("order_access_required"));
  }
  return vaptApiRequest<RequestCheckTableSessionDto>({
    method: "POST",
    route: `/public/table-sessions/${encodeURIComponent(sessionId)}/request-check`,
    requireAuth: false,
    body: { publicOrderId, publicOrderToken },
  });
}
