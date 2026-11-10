import {restaurantRoute} from "@/lib/restaurants";
import type {
  CloseTableSessionDto,
  TableSessionDetailDto,
  TableSessionSummaryDto,
  TransferTableSessionDto,
} from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

const sessionRoute = (restaurantId:string,sessionId: string) =>
  `${restaurantRoute(restaurantId)}/table-sessions/${encodeURIComponent(sessionId)}`;

export function listTableSessions(restaurantId:string): Promise<TableSessionSummaryDto[]> {
  return vaptApiRequest<TableSessionSummaryDto[]>({
    method: "GET",
    route: `${restaurantRoute(restaurantId)}/table-sessions`,
  });
}

export function getTableSession(restaurantId:string,sessionId: string, signal?: AbortSignal): Promise<TableSessionDetailDto> {
  return vaptApiRequest<TableSessionDetailDto>({
    method: "GET",
    route: sessionRoute(restaurantId,sessionId),
    ...(signal ? { signal } : {}),
  });
}

export function closeTableSession(restaurantId:string,sessionId: string): Promise<CloseTableSessionDto> {
  return vaptApiRequest<CloseTableSessionDto>({
    method: "POST",
    route: `${sessionRoute(restaurantId,sessionId)}/close`,
  });
}

export function transferTableSession(
  restaurantId:string,
  sessionId: string,
  tableNumber: string,
): Promise<TransferTableSessionDto> {
  return vaptApiRequest<TransferTableSessionDto>({
    method: "POST",
    route: `${sessionRoute(restaurantId,sessionId)}/transfer`,
    body: { tableNumber },
  });
}
