export const realtimeTopics = ["orders", "kitchen", "table_sessions", "payments"] as const;
export type RealtimeTopic = (typeof realtimeTopics)[number];
const reasons = ["created", "updated", "cancelled", "payment_changed", "check_requested", "closed", "transferred"] as const;
export type RealtimeEnvelope = {
  version: 1; eventId: string; sequence: number; topic: RealtimeTopic; entityId: string; reason: (typeof reasons)[number];
};
export type RealtimeReady = { version: 1; type: "ready"; leaseExpiresAt: number };
export type RealtimeAck = { version: 1; type: "ack"; sequence: number };
export type RealtimeScope = { mode: "owner"; userId: string; restaurantId: string }
  | { mode: "order"; orderId: string; token: string };
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.keys(value).length === keys.length
    && Object.keys(value).every(key => keys.includes(key));
}
export function parseRealtimeEnvelope(value: unknown): RealtimeEnvelope | null {
  try {
    if (!record(value, ["version", "eventId", "sequence", "topic", "entityId", "reason"])) return null;
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 4096) return null;
    const { version, eventId, sequence, topic, entityId, reason } = value;
    if (version !== 1 || typeof eventId !== "string" || !uuidPattern.test(eventId)
      || typeof entityId !== "string" || !uuidPattern.test(entityId)
      || typeof sequence !== "number" || !Number.isSafeInteger(sequence) || sequence < 0
      || !realtimeTopics.includes(topic as RealtimeTopic) || !reasons.includes(reason as RealtimeEnvelope["reason"])) return null;
    return { version, eventId, sequence, topic: topic as RealtimeTopic, entityId, reason: reason as RealtimeEnvelope["reason"] };
  } catch { return null; }
}
export function parseRealtimeReady(value: unknown): RealtimeReady | null {
  if (!record(value, ["version", "type", "leaseExpiresAt"]) || value.version !== 1 || value.type !== "ready"
    || typeof value.leaseExpiresAt !== "number" || !Number.isSafeInteger(value.leaseExpiresAt)) return null;
  return { version: 1, type: "ready", leaseExpiresAt: value.leaseExpiresAt };
}
export function sameRealtimeScope(a: RealtimeScope, b: RealtimeScope): boolean {
  return a.mode === "owner" && b.mode === "owner" ? a.userId === b.userId && a.restaurantId === b.restaurantId
    : a.mode === "order" && b.mode === "order" && a.orderId === b.orderId && a.token === b.token;
}
