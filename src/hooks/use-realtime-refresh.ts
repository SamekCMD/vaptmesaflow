import { useEffect, useRef } from "react";
import { subscribeRealtime, type RealtimeState } from "@/lib/realtime/client";
import { sameRealtimeScope, type RealtimeScope, type RealtimeTopic } from "@/lib/realtime/contracts";
import { createResyncQueue } from "@/lib/realtime/resync";
type Options = { scopes: readonly RealtimeScope[]; topics: readonly RealtimeTopic[]; enabled: boolean;
  refresh: () => Promise<void>; fallbackMs: number; active?: boolean };
export function useRealtimeRefresh({ scopes, topics, enabled, refresh, fallbackMs, active: resourceActive = true }: Options): () => void {
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  const manualRefreshRef = useRef<() => void>(() => {});
  const scopesRef = useRef(scopes);
  if (scopes.length !== scopesRef.current.length || scopes.some((scope, index) => !sameRealtimeScope(scope, scopesRef.current[index]))) scopesRef.current = scopes;
  const stableScopes = scopesRef.current;
  const currentResource = useRef({ active: resourceActive, scopes: stableScopes });
  currentResource.current = { active: resourceActive, scopes: stableScopes };
  const queueRef = useRef<ReturnType<typeof createResyncQueue>>();
  const priorResource = useRef<{ active: boolean; scopes: readonly RealtimeScope[] }>({ active: false, scopes: [] });
  const topicKey = [...new Set(topics)].sort().join(",");
  useEffect(() => {
    const scopeDiscovered = priorResource.current.active && resourceActive
      && priorResource.current.scopes.length === 0 && stableScopes.length > 0;
    priorResource.current = { active: resourceActive, scopes: stableScopes };
    if (!resourceActive) return;
    const active = () => navigator.onLine !== false && !document.hidden;
    const queue = scopeDiscovered && queueRef.current ? queueRef.current
      : createResyncQueue(() => active() ? refreshRef.current() : Promise.resolve());
    queueRef.current = queue;
    manualRefreshRef.current = () => { if (active()) queue.refreshNow(); };
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
    if (active() && !scopeDiscovered) queue.refreshNow();
    schedule();
    return () => {
      disposed = true; clearTimeout(timer);
      const next = currentResource.current;
      const discovering = resourceActive && next.active && stableScopes.length === 0 && next.scopes.length > 0;
      if (!discovering) { queue.dispose(); if (queueRef.current === queue) queueRef.current = undefined; }
      manualRefreshRef.current = () => {};
      for (const stop of stops) stop();
      window.removeEventListener("online", environmentChanged); window.removeEventListener("offline", environmentChanged);
      document.removeEventListener("visibilitychange", environmentChanged);
    };
  }, [stableScopes, topicKey, enabled, fallbackMs, resourceActive]);
  return () => manualRefreshRef.current();
}
