import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizeMenuImage, type DecodedMenuImage } from "@/lib/menu-image-optimization";

function codec(width = 2400, height = 1200, encode = (_w: number, _h: number, type: string, _q?: number) => new Blob([new Uint8Array(200_000)], { type })) {
  const decoded: DecodedMenuImage = { width, height, encode: vi.fn(async (...args) => encode(...args)), close: vi.fn() };
  return { decoded, decode: vi.fn(async () => decoded) };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("automatic menu image optimization", () => {
  it("draws a 300×150 source instead of encoding the canvas default blank bitmap and releases its object URL", async () => {
    const drawImage = vi.fn(); const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:synthetic-source", revokeObjectURL });
    vi.stubGlobal("Image", class {
      naturalWidth = 300; naturalHeight = 150; onload: (() => void) | null = null; onerror = null;
      set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); }
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({ drawImage } as never);
    vi.spyOn(canvas, "toBlob").mockImplementation(callback => callback(new Blob(["webp-bitmap"], { type: "image/webp" })));
    vi.spyOn(document, "createElement").mockReturnValue(canvas);
    const result = await optimizeMenuImage(new Blob(["png"], { type: "image/png" }));
    expect(result.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 150);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-source");
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s without requiring users to convert files", async type => {
    const value = codec();
    const result = await optimizeMenuImage(new Blob([new Uint8Array(2_000_000)], { type }), value.decode);
    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(200_000);
    expect(value.decoded.encode).toHaveBeenCalledWith(1200, 600, "image/webp", 0.82);
    expect(value.decoded.close).toHaveBeenCalledOnce();
  });

  it("also converts small-dimension PNGs, never upscaling them", async () => {
    const value = codec(500, 1000);
    await optimizeMenuImage(new Blob(["png"], { type: "image/png" }), value.decode);
    expect(value.decoded.encode).toHaveBeenCalledWith(500, 1000, "image/webp", 0.82);
  });

  it("adapts quality and then dimensions within a bounded encoding budget", async () => {
    const value = codec(2400, 1200, (w, _h, type, quality) => new Blob([new Uint8Array(w === 1200 ? 600_000 : quality === 0.72 ? 250_000 : 500_000)], { type }));
    const result = await optimizeMenuImage(new Blob(["jpeg"], { type: "image/jpeg" }), value.decode);
    expect(result.size).toBe(250_000);
    expect(value.decoded.encode).toHaveBeenCalledTimes(5);
    expect(value.decoded.encode).toHaveBeenLastCalledWith(960, 480, "image/webp", 0.72);
  });

  it("preserves alpha via PNG fallback when the browser cannot encode WebP", async () => {
    const value = codec(800, 800, (_w, _h, type) => new Blob([new Uint8Array(100_000)], { type: type === "image/webp" ? "image/png" : type }));
    const result = await optimizeMenuImage(new Blob(["transparent-png"], { type: "image/png" }), value.decode);
    expect(result.type).toBe("image/png");
    expect(value.decoded.encode).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), "image/jpeg", expect.anything());
  });

  it("uses JPEG fallback for photos when WebP encoding is unavailable", async () => {
    const value = codec(800, 800, (_w, _h, type) => new Blob(["encoded"], { type: type === "image/webp" ? "image/png" : type }));
    expect((await optimizeMenuImage(new Blob(["photo"], { type: "image/jpeg" }), value.decode)).type).toBe("image/jpeg");
  });

  it("does not crush quality indefinitely to claim every image fits the target", async () => {
    const value = codec(2400, 1200, (_w, _h, type) => new Blob([new Uint8Array(400_000)], { type }));
    expect((await optimizeMenuImage(new Blob(["image"], { type: "image/jpeg" }), value.decode)).size).toBe(400_000);
    expect(value.decoded.encode).toHaveBeenCalledTimes(9);
  });

  it("rejects an output exceeding 1 MiB and releases decoded resources", async () => {
    const value = codec(2400, 1200, (_w, _h, type) => new Blob([new Uint8Array(1_048_577)], { type }));
    await expect(optimizeMenuImage(new Blob(["image"], { type: "image/jpeg" }), value.decode)).rejects.toThrow(/comprimir/i);
    expect(value.decoded.close).toHaveBeenCalledOnce();
    expect(value.decoded.encode).toHaveBeenCalledTimes(9);
  });

  it("rejects unsupported, empty and oversized inputs before decoding", async () => {
    const value = codec();
    for (const source of [new Blob(["svg"], { type: "image/svg+xml" }), new Blob([], { type: "image/png" }),
      new Blob([new Uint8Array(5_242_881)], { type: "image/jpeg" })]) {
      await expect(optimizeMenuImage(source, value.decode)).rejects.toThrow();
    }
    expect(value.decode).not.toHaveBeenCalled();
  });

  it("bounds decoded pixels and rejects empty encoder output without leaking resources", async () => {
    for (const value of [codec(0, 100), codec(8000, 8000), codec(100, 100, () => new Blob([], { type: "image/webp" }))]) {
      await expect(optimizeMenuImage(new Blob(["png"], { type: "image/png" }), value.decode)).rejects.toThrow();
      expect(value.decoded.close).toHaveBeenCalledOnce();
    }
  });
});
