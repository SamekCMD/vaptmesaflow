import { useEffect, useRef } from "react";
import { subscribeRealtime, type RealtimeState } from "@/lib/realtime/client";
import { sameRealtimeScope, type RealtimeScope, type RealtimeTopic } from "@/lib/realtime/contracts";
import { createResyncQueue } from "@/lib/realtime/resync";
type Options = { scopes: readonly RealtimeScope[]; topics: readonly RealtimeTopic[]; enabled: boolean;
  refresh: () => Promise<void>; fallbackMs: number };
export function useRealtimeRefresh({ scopes, topics, enabled, refresh, fallbackMs }: Options): void {
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  const scopesRef = useRef(scopes);
  if (scopes.length !== scopesRef.current.length || scopes.some((scope, index) => !sameRealtimeScope(scope, scopesRef.current[index]))) scopesRef.current = scopes;
  const stableScopes = scopesRef.current;
  const topicKey = [...new Set(topics)].sort().join(",");
  useEffect(() => {
    const active = () => navigator.onLine !== false && !document.hidden;
    const queue = createResyncQueue(() => active() ? refreshRef.current() : Promise.resolve());
    const acceptedTopics = new Set(topicKey.split(","));
    const states = stableScopes.map((): RealtimeState => "fallback");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false; let healthy = false;
    const schedule = () => {
      clearTimeout(timer); timer = undefined;
      if (disposed || !active()) return;
      timer = setTimeout(() => { queue.refreshNow(); schedule(); }, healthy ? 30_000 : Math.max(1000, fallbackMs));
    };
    const stops = enabled ? stableScopes.map((scope, index) => subscribeRealtime(scope, value => {
      if (!active() || disposed) return;
      if (value === "connected") queue.invalidate();
      else if (acceptedTopics.has(value.topic)) queue.invalidate();
    }, value => {
      states[index] = value;
      const nextHealthy = states.length > 0 && states.every(state => state === "connected");
      if (healthy !== nextHealthy) { healthy = nextHealthy; schedule(); }
    })) : [];
    const environmentChanged = () => {
      if (active()) queue.refreshNow();
      schedule();
    };
    window.addEventListener("online", environmentChanged); window.addEventListener("offline", environmentChanged);
    document.addEventListener("visibilitychange", environmentChanged);
    if (active()) queue.refreshNow();
    schedule();
    return () => {
      disposed = true; queue.dispose(); clearTimeout(timer);
      for (const stop of stops) stop();
      window.removeEventListener("online", environmentChanged); window.removeEventListener("offline", environmentChanged);
      document.removeEventListener("visibilitychange", environmentChanged);
    };
  }, [stableScopes, topicKey, enabled, fallbackMs]);
}
