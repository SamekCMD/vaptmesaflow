import type {
  CloseTableSessionDto,
  TableSessionDetailDto,
  TableSessionSummaryDto,
  TransferTableSessionDto,
} from "@/lib/business-api.types";
import { vaptApiRequest } from "@/lib/vapt-api-client";

const sessionRoute = (sessionId: string) =>
  `/restaurants/me/table-sessions/${encodeURIComponent(sessionId)}`;

export function listTableSessions(): Promise<TableSessionSummaryDto[]> {
  return vaptApiRequest<TableSessionSummaryDto[]>({
    method: "GET",
    route: "/restaurants/me/table-sessions",
  });
}

export function getTableSession(sessionId: string, signal?: AbortSignal): Promise<TableSessionDetailDto> {
  return vaptApiRequest<TableSessionDetailDto>({
    method: "GET",
    route: sessionRoute(sessionId),
    ...(signal ? { signal } : {}),
  });
}

export function closeTableSession(sessionId: string): Promise<CloseTableSessionDto> {
  return vaptApiRequest<CloseTableSessionDto>({
    method: "POST",
    route: `${sessionRoute(sessionId)}/close`,
  });
}

export function transferTableSession(
  sessionId: string,
  tableNumber: string,
): Promise<TransferTableSessionDto> {
  return vaptApiRequest<TransferTableSessionDto>({
    method: "POST",
    route: `${sessionRoute(sessionId)}/transfer`,
    body: { tableNumber },
  });
}
