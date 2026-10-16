import { useCallback, useEffect, useRef, useState } from "react";
import { ENV } from "@/lib/env";
import { acquirePublicCatalog, disabledCatalogView } from "@/lib/catalog/client";
import type { CatalogResource, PublicCatalogView } from "@/lib/catalog/controller";

const loading: PublicCatalogView = { state: null, status: "loading", errorCode: null };
export function usePublicCatalog(slug: string): PublicCatalogView & { refresh(): void } {
  const apiBaseUrl = ENV.vaptApiBaseUrl;
  const key = `${apiBaseUrl}\0${slug}`;
  const resource = useRef<CatalogResource | null>(null);
  const [observed, setObserved] = useState({ key, view: loading });
  useEffect(() => {
    let handle: CatalogResource;
    try { handle = acquirePublicCatalog({ apiBaseUrl, slug }); }
    catch { setObserved({ key, view: { state: null, status: "unavailable", errorCode: "catalog_invalid_resource" } }); return; }
    resource.current = handle;
    const update = () => setObserved({ key, view: handle.getSnapshot() });
    const unsubscribe = handle.subscribe(update); update();
    return () => { unsubscribe(); handle.release(); if (resource.current === handle) resource.current = null; };
  }, [apiBaseUrl, slug, key]);
  const refresh = useCallback(() => resource.current?.refresh(), []);
  const view = !ENV.publicCatalogEventsEnabled ? disabledCatalogView : observed.key === key ? observed.view : loading;
  return { ...view, refresh };
}
