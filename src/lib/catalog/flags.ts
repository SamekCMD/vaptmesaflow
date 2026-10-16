import { ENV } from "@/lib/env";

// Readers require receipt-aware owners, but a reader rollback must never
// silently return owners to legacy DTO handling while accepted work drains.
export const catalogWriterEnabled = (): boolean => ENV.publicCatalogEventsEnabled || ENV.publicCatalogWriterEnabled;
