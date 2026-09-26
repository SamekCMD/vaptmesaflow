import type { OverviewDto, OverviewPeriod } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

export function fetchOwnedOverview(period: OverviewPeriod): Promise<OverviewDto> {
  return vaptApiRequest<OverviewDto>({
    method: "GET",
    route: "/restaurants/me/overview",
    query: { period },
  });
}
