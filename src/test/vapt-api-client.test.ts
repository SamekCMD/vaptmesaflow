import { afterEach, describe, expect, test, vi } from "vitest";

import { VaptApiClientError, vaptApiRequest } from "@/lib/vapt-api-client";
import { createResyncQueue } from "@/lib/realtime/resync";

describe("vaptApiRequest", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("a stalled snapshot is aborted by its deadline and the dirty queue recovers serially", async () => {
    vi.useFakeTimers(); let active = 0; let peak = 0; let late!: (value: Response) => void;
    const applied: number[] = [];
    const fetchSpy = vi.fn().mockImplementationOnce((_url, options) => new Promise<Response>((resolve, reject) => {
      late = resolve; active++; peak = Math.max(peak, active);
      options.signal?.addEventListener("abort", () => { active--; reject(options.signal.reason); }, { once: true });
    })).mockImplementation(async () => {
      active++; peak = Math.max(peak, active); active--;
      return new Response('{"revision":2}');
    });
    vi.stubGlobal("fetch", fetchSpy);
    const queue = createResyncQueue(async () => { applied.push((await vaptApiRequest<{revision:number}>({method:"GET",route:"/restaurants/me/kitchen/orders"})).revision); });
    queue.refreshNow(); queue.invalidate();
    await vi.advanceTimersByTimeAsync(14_999); expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2); expect(peak).toBe(1); expect(applied).toEqual([2]);
    late(new Response('{"revision":1}')); await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([2]); queue.dispose(); expect(vi.getTimerCount()).toBe(0);
  });

  test("the read deadline covers a stalled body and rejects a late body after cancellation", async () => {
    vi.useFakeTimers(); let finish!: (value:string)=>void; let signal!: AbortSignal;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url, options) => {
      signal=options.signal;
      return {ok:true,status:200,text:()=>new Promise<string>(resolve=>{finish=resolve;})};
    }));
    const pending=vaptApiRequest({method:"GET",route:"/public/orders/synthetic"});
    const rejected=expect(pending).rejects.toMatchObject({name:"TimeoutError"});
    await vi.advanceTimersByTimeAsync(15_000); expect(signal?.aborted).toBe(true);
    await rejected; finish('{"revision":1}'); await vi.advanceTimersByTimeAsync(0); expect(vi.getTimerCount()).toBe(0);
  });

  test("authenticated API requests use cookies without Supabase bearer tokens", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await vaptApiRequest({ method: "GET", route: "/restaurants/me" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.test.example.com/restaurants/me",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  test("server 401 responses retain the invalid session error contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "unauthorized", message: "Sessão inválida. Faça login novamente." },
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })));

    await expect(vaptApiRequest({
      method: "GET",
      route: "/restaurants/me",
    })).rejects.toEqual(expect.objectContaining<VaptApiClientError>({
      code: "unauthorized",
      message: "Sessão inválida. Faça login novamente.",
      status: 401,
    }));
  });
});
