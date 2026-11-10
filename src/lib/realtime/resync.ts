/** One authoritative read at a time; a signal during it leaves one dirty read. */
export function createResyncQueue(refresh: () => Promise<void>) {
  let disposed = false; let running = false; let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    clearTimeout(timer); timer = undefined;
    if (disposed) return;
    if (running) { dirty = true; return; }
    running = true;
    do {
      dirty = false;
      try { await refresh(); } catch { /* next signal/poll recovers */ }
    } while (dirty && !disposed);
    running = false;
  };
  return {
    refreshNow() { void run(); },
    invalidate() {
      if (disposed) return;
      if (running) { dirty = true; return; }
      if (timer === undefined) timer = setTimeout(() => { void run(); }, 250);
    },
    dispose() { disposed = true; dirty = false; clearTimeout(timer); timer = undefined; },
  };
}
