import {restaurantRoute} from "@/lib/restaurants";
import type { OverviewDto, OverviewPeriod } from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

export function fetchOwnedOverview(restaurantId:string,period: OverviewPeriod): Promise<OverviewDto> {
  return vaptApiRequest<OverviewDto>({
    method: "GET",
    route: `${restaurantRoute(restaurantId)}/overview`,
    query: { period },
  });
}
